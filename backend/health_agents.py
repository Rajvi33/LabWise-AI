import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from octochains import Agent, Aggregator, Engine
from pydantic import ValidationError

from .llm_client import LLMClient, LLMResponseError, extract_json
from .schemas import AnalysisResult, LabValue, SAFETY_DISCLAIMER


COMMON_TEST_HINTS = {
    "hemoglobin": "Hemoglobin carries oxygen in red blood cells.",
    "wbc": "White blood cells help your body respond to infection and inflammation.",
    "white blood cells": "White blood cells help your body respond to infection and inflammation.",
    "platelet": "Platelets help blood clot.",
    "glucose": "Glucose is the amount of sugar measured in the blood.",
    "cholesterol": "Cholesterol is a blood fat related to heart and blood vessel risk discussions.",
    "hdl": "HDL is often called good cholesterol.",
    "ldl": "LDL is often called bad cholesterol.",
    "triglycerides": "Triglycerides are a type of fat in the blood.",
    "creatinine": "Creatinine is commonly used to discuss kidney filtration.",
    "tsh": "TSH is a thyroid signaling hormone.",
}

HEADER_WORDS = {
    "test",
    "tests",
    "result",
    "results",
    "unit",
    "units",
    "range",
    "reference",
    "normal",
    "flag",
    "status",
    "method",
}

NON_LAB_NAME_WORDS = {
    "patient",
    "name",
    "date",
    "age",
    "page",
    "phone",
    "address",
    "doctor",
    "physician",
    "collected",
    "reported",
    "specimen",
    "laboratory",
    "lab",
    "invoice",
    "mrn",
    "gender",
    "sex",
}

COMMON_UNITS = (
    "g/dl",
    "mg/dl",
    "ng/ml",
    "pg/ml",
    "iu/l",
    "u/l",
    "mmol/l",
    "umol/l",
    "µmol/l",
    "10^3/ul",
    "10^6/ul",
    "x10^3/ul",
    "x10^6/ul",
    "k/ul",
    "m/ul",
    "%",
    "fl",
    "pg",
    "meq/l",
)


def _safe_loads(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    try:
        return extract_json(raw)
    except LLMResponseError:
        return {}


def _to_float(value: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _range_bounds(reference_range: str) -> tuple[float | None, float | None]:
    text = reference_range.replace(",", "")
    pair = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:-|to|–|—)\s*(-?\d+(?:\.\d+)?)", text, re.I)
    if pair:
        return float(pair.group(1)), float(pair.group(2))

    low = re.search(r"(?:>|>=|greater than)\s*(-?\d+(?:\.\d+)?)", text, re.I)
    if low:
        return float(low.group(1)), None

    high = re.search(r"(?:<|<=|less than)\s*(-?\d+(?:\.\d+)?)", text, re.I)
    if high:
        return None, float(high.group(1))

    return None, None


def classify_value(value: str, reference_range: str) -> str:
    combined = f"{value} {reference_range}".lower()
    if re.search(r"\b(critical|panic|critial)\b", combined):
        return "critical"
    if re.search(r"\b(high|above| h)\b", combined):
        return "high"
    if re.search(r"\b(low|below| l)\b", combined):
        return "low"
    numeric_value = _to_float(value)
    low, high = _range_bounds(reference_range)
    if numeric_value is None or (low is None and high is None):
        return "unknown"
    if low is not None and numeric_value < low:
        return "low"
    if high is not None and numeric_value > high:
        return "high"
    return "normal"


def simple_explanation(test_name: str, status: str) -> str:
    key = test_name.lower()
    base = next((hint for name, hint in COMMON_TEST_HINTS.items() if name in key), f"{test_name} is one item measured in this report.")
    if status == "normal":
        return f"{base} This value appears to be within the listed reference range."
    if status == "low":
        return f"{base} This value appears below the listed reference range and is worth discussing with a clinician."
    if status == "high":
        return f"{base} This value appears above the listed reference range and is worth discussing with a clinician."
    if status == "critical":
        return f"{base} This value is marked critical in the report text and should be discussed promptly with a qualified healthcare professional."
    return f"{base} The available text does not provide enough information to confidently compare it with a reference range."


def suggested_questions(test_name: str, status: str) -> list[str]:
    return [
        f"What could make my {test_name} {status} in the context of my health history?",
        f"Should this {test_name} result be repeated or compared with older reports?",
    ]


def heuristic_extract_labs(report_text: str) -> list[dict[str, str]]:
    labs: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    lines = _candidate_lines(report_text)

    for line in lines:
        parsed = parse_lab_line(line)
        if not parsed:
            continue
        key = (parsed["test_name"].lower(), parsed["value"])
        if key in seen:
            continue
        seen.add(key)
        labs.append(parsed)
    return labs[:40]


def _candidate_lines(report_text: str) -> list[str]:
    raw_lines = [re.sub(r"\s+", " ", line).strip() for line in report_text.splitlines()]
    raw_lines = [line for line in raw_lines if line and not line.startswith("--- Page")]
    combined: list[str] = []

    for index, line in enumerate(raw_lines):
        combined.append(line)
        if index + 1 < len(raw_lines):
            next_line = raw_lines[index + 1]
            if _looks_like_test_name_only(line) and re.search(r"\d", next_line):
                combined.append(f"{line} {next_line}")

    return combined


def _looks_like_test_name_only(line: str) -> bool:
    words = line.split()
    if not 1 <= len(words) <= 7:
        return False
    if re.search(r"\d", line):
        return False
    if _is_header_line(line):
        return False
    return bool(re.search(r"[A-Za-z]{3,}", line)) and not _is_bad_name(line)


def parse_lab_line(line: str) -> dict[str, str] | None:
    clean_line = _normalize_lab_line(line)
    if len(clean_line) < 5 or not re.search(r"\d", clean_line):
        return None
    if _is_header_line(clean_line):
        return None

    tokens = [token.strip() for token in re.split(r"\s*\|\s*|\s{2,}", clean_line) if token.strip()]
    parsed = _parse_pipe_tokens(tokens) if len(tokens) >= 3 else None
    if parsed:
        return parsed

    for pattern in _lab_patterns():
        match = pattern.search(clean_line)
        if not match:
            continue
        name = _clean_test_name(match.group("name"))
        if _is_bad_name(name):
            continue
        value = match.group("value").strip()
        unit = (match.groupdict().get("unit") or "").strip(" ,;")
        reference_range = (match.groupdict().get("range") or "").strip(" ,;")
        flag = (match.groupdict().get("flag") or match.groupdict().get("flag_after") or "").strip()
        status = _status_from_flag(flag) or classify_value(value, reference_range)
        return {
            "test_name": name,
            "value": value,
            "unit": unit,
            "reference_range": reference_range,
            "status": status,
        }
    return None


def _normalize_lab_line(line: str) -> str:
    line = line.replace("–", "-").replace("—", "-").replace("\u00a0", " ")
    line = re.sub(r"\bRef(?:erence)?(?: Interval| Range)?\b", "Reference Range", line, flags=re.I)
    line = re.sub(r"\bNormal Range\b", "Reference Range", line, flags=re.I)
    line = re.sub(r"\s+", " ", line)
    return line.strip()


def _parse_pipe_tokens(tokens: list[str]) -> dict[str, str] | None:
    if _is_header_line(" ".join(tokens)):
        return None

    name_index = next((idx for idx, token in enumerate(tokens) if re.search(r"[A-Za-z]{3,}", token) and not re.search(r"\d", token)), None)
    value_index = next((idx for idx, token in enumerate(tokens) if re.search(r"[<>]?\d+(?:\.\d+)?", token)), None)
    if name_index is None or value_index is None or value_index <= name_index:
        return None

    name = _clean_test_name(tokens[name_index])
    if _is_bad_name(name):
        return None

    value = re.search(r"[<>]?\d+(?:\.\d+)?", tokens[value_index])
    if not value:
        return None

    unit = ""
    reference_range = ""
    flag = ""
    for token in tokens[value_index + 1 : value_index + 5]:
        lower = token.lower()
        if not unit and _looks_like_unit(token):
            unit = token
        elif not reference_range and _looks_like_range(token):
            reference_range = token
        elif not flag and re.search(r"\b(low|high|critical|normal|l|h|panic)\b", lower):
            flag = token

    status = _status_from_flag(flag) or classify_value(value.group(0), reference_range)
    return {
        "test_name": name,
        "value": value.group(0),
        "unit": unit,
        "reference_range": reference_range,
        "status": status,
    }


def _lab_patterns() -> list[re.Pattern[str]]:
    name = r"(?P<name>[A-Za-z][A-Za-z0-9 /().,%#'+-]{2,64}?)"
    value = r"(?P<value>[<>]?\d+(?:\.\d+)?)"
    unit = r"(?P<unit>[A-Za-zµ/%0-9^.*-]+)?"
    range_value = r"(?P<range>\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?|[<>]=?\s*\d+(?:\.\d+)?)"
    flag = r"(?P<flag>low|high|critical|panic|normal|abnormal|L|H|LL|HH)?"
    flag_after = r"(?P<flag_after>low|high|critical|panic|normal|abnormal|L|H|LL|HH)?"
    return [
        re.compile(
            rf"{name}\s*[:\-]?\s*{value}\s*{unit}\s*(?:{flag}\s*)?(?:Reference Range|range)?\s*[:\-]?\s*{range_value}\b\s*{flag_after}",
            re.I,
        ),
        re.compile(
            rf"{name}\s+{value}\s+{unit}\s+(?:{flag}\s+)?{range_value}\b\s*{flag_after}",
            re.I,
        ),
        re.compile(
            rf"{name}\s+{value}\s+(?:{flag}\s+)?{unit}\b",
            re.I,
        ),
    ]


def _clean_test_name(name: str) -> str:
    name = re.sub(r"^(test|result|lab|component|analyte)\s+", "", name, flags=re.I)
    name = re.sub(r"\b(result|value|unit|reference range|flag|status)$", "", name, flags=re.I)
    name = re.sub(r"[^A-Za-z0-9 /().,%#'+-]", "", name)
    return re.sub(r"\s+", " ", name).strip(" :-")


def _is_header_line(line: str) -> bool:
    words = set(re.findall(r"[A-Za-z]+", line.lower()))
    return len(words & HEADER_WORDS) >= 3 and not re.search(r"[A-Za-z]{3,}.*\d", line)


def _is_bad_name(name: str) -> bool:
    lower = name.lower().strip()
    if len(lower) < 3 or len(lower) > 70:
        return True
    words = set(re.findall(r"[A-Za-z]+", lower))
    if words & NON_LAB_NAME_WORDS:
        return True
    if lower in {"date", "age", "page", "phone", "result", "reference range"}:
        return True
    return False


def _looks_like_unit(token: str) -> bool:
    normalized = token.lower().replace(" ", "")
    return any(unit.replace(" ", "") in normalized for unit in COMMON_UNITS) or bool(re.fullmatch(r"[A-Za-zµ/%0-9^.*-]{1,12}", token))


def _looks_like_range(token: str) -> bool:
    return bool(re.search(r"\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?|[<>]=?\s*\d+(?:\.\d+)?", token, re.I))


def _status_from_flag(flag: str) -> str | None:
    lower = flag.lower().strip()
    if lower in {"critical", "panic", "hh", "ll"}:
        return "critical"
    if lower in {"h", "high", "above"}:
        return "high"
    if lower in {"l", "low", "below"}:
        return "low"
    if lower == "normal":
        return "normal"
    return None


def normalize_labs(raw_labs: list[dict[str, Any]]) -> list[LabValue]:
    values: list[LabValue] = []
    for item in raw_labs:
        status = item.get("status") or classify_value(str(item.get("value", "")), str(item.get("reference_range", "")))
        if status not in {"normal", "low", "high", "critical", "unknown"}:
            status = "unknown"
        explanation = item.get("explanation") or simple_explanation(str(item.get("test_name", "Lab value")), status)
        values.append(
            LabValue(
                test_name=str(item.get("test_name", "Unknown test")),
                value=str(item.get("value", "")),
                unit=str(item.get("unit", "")),
                reference_range=str(item.get("reference_range", "")),
                status=status,
                explanation=explanation,
            )
        )
    return values


class LabExtractionAgent(Agent):
    def __init__(self, llm_client: LLMClient):
        super().__init__(
            role="LabExtractionAgent",
            goal="Extract blood test names, values, units, and reference ranges.",
            input_description="raw text from a blood report PDF",
            llm_callable=llm_client.complete,
        )
        self.llm_client = llm_client

    def execute(self, problem_data: str) -> dict[str, Any]:
        if self.llm_client.mock_mode:
            return {"labs": heuristic_extract_labs(problem_data)}

        prompt = f"""
Extract lab results from this blood report text.
Return ONLY valid JSON:
{{"labs":[{{"test_name":"", "value":"", "unit":"", "reference_range":""}}]}}
If unsure, leave fields blank. Do not diagnose.

Report text:
{problem_data}
"""
        return extract_json(self.llm_callable(prompt))


class AbnormalityAgent(Agent):
    def __init__(self, llm_client: LLMClient):
        super().__init__(
            role="AbnormalityAgent",
            goal="Decide whether each blood test value is normal, low, high, or unknown.",
            input_description="raw text from a blood report PDF",
            llm_callable=llm_client.complete,
        )
        self.llm_client = llm_client

    def execute(self, problem_data: str) -> dict[str, Any]:
        labs = heuristic_extract_labs(problem_data)
        if self.llm_client.mock_mode:
            return {"labs": [{**lab, "status": classify_value(lab["value"], lab["reference_range"])} for lab in labs]}

        prompt = f"""
Classify the lab values in this blood report as normal, low, high, critical, or unknown using the listed reference ranges and report flags only.
Return ONLY valid JSON:
{{"labs":[{{"test_name":"", "value":"", "unit":"", "reference_range":"", "status":"normal|low|high|critical|unknown"}}]}}
Do not diagnose and do not recommend medicine.

Report text:
{problem_data}
"""
        return extract_json(self.llm_callable(prompt))


class PatientExplanationAgent(Agent):
    def __init__(self, llm_client: LLMClient):
        super().__init__(
            role="PatientExplanationAgent",
            goal="Explain blood report values in simple educational language.",
            input_description="raw text from a blood report PDF",
            llm_callable=llm_client.complete,
        )
        self.llm_client = llm_client

    def execute(self, problem_data: str) -> dict[str, Any]:
        labs = normalize_labs(heuristic_extract_labs(problem_data))
        if self.llm_client.mock_mode:
            return {"explanations": [lab.model_dump() for lab in labs]}

        prompt = f"""
Explain the blood report in simple educational language.
Return ONLY valid JSON:
{{"summary":"", "explanations":[{{"test_name":"", "explanation":""}}], "doctor_discussion_points":[""]}}
Never diagnose, prescribe, or suggest starting/stopping medicine.

Report text:
{problem_data}
"""
        return extract_json(self.llm_callable(prompt))


class SafetyAgent(Agent):
    def __init__(self, llm_client: LLMClient):
        super().__init__(
            role="SafetyAgent",
            goal="Ensure the report stays educational and avoids diagnosis or prescribing.",
            input_description="raw text from a blood report PDF",
            llm_callable=llm_client.complete,
        )
        self.llm_client = llm_client

    def execute(self, problem_data: str) -> dict[str, Any]:
        return {
            "safety_rules": [
                "Do not diagnose disease.",
                "Do not prescribe medicine or dosing.",
                "Do not tell the user to start or stop medicine.",
                "Encourage discussion with a qualified healthcare professional.",
            ],
            "safety_disclaimer": SAFETY_DISCLAIMER,
        }


class HealthReportAggregator(Aggregator):
    def __init__(self, llm_client: LLMClient):
        super().__init__(
            role="HealthReportAggregator",
            goal="Combine agent outputs into one safe patient-friendly blood report analysis.",
            llm_callable=llm_client.complete,
        )
        self.llm_client = llm_client

    def execute(self, agent_reports: dict[str, str]) -> dict[str, Any]:
        fallback = build_fallback_analysis(agent_reports)
        if self.llm_client.mock_mode:
            return fallback.model_dump()

        prompt = f"""
Combine these Octochains agent reports into the exact JSON shape below.
Use only the report data. Keep explanations simple and educational.
Never diagnose, prescribe, recommend medication dosing, or tell a user to start/stop medicine.
Always include the exact safety_disclaimer string.

Agent reports:
{self._format_reports(agent_reports)}

Return ONLY valid JSON:
{{
  "summary": "...",
  "normal_values": [
    {{"test_name":"...", "value":"...", "unit":"...", "reference_range":"...", "status":"normal", "explanation":"..."}}
  ],
  "abnormal_values": [
    {{"test_name":"...", "value":"...", "unit":"...", "reference_range":"...", "status":"low|high|critical|unknown", "explanation":"...", "suggested_doctor_questions":["..."]}}
  ],
  "doctor_discussion_points": ["..."],
  "safety_disclaimer": "{SAFETY_DISCLAIMER}"
}}
"""
        try:
            result = extract_json(self.llm_callable(prompt))
            return AnalysisResult.model_validate(result).model_dump()
        except (LLMResponseError, ValidationError):
            return fallback.model_dump()


def build_fallback_analysis(agent_reports: dict[str, str]) -> AnalysisResult:
    labs_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    explanation_by_name: dict[str, str] = {}
    discussion_points: list[str] = []

    for raw in agent_reports.values():
        data = _safe_loads(raw)
        for lab in data.get("labs", []):
            key = (str(lab.get("test_name", "")).lower(), str(lab.get("value", "")))
            if key[0]:
                labs_by_key[key] = {**labs_by_key.get(key, {}), **lab}
        for item in data.get("explanations", []):
            if item.get("test_name"):
                explanation_by_name[str(item["test_name"]).lower()] = str(item.get("explanation", ""))
        discussion_points.extend(str(point) for point in data.get("doctor_discussion_points", []) if point)

    labs = normalize_labs(list(labs_by_key.values()))
    normal_values = []
    abnormal_values = []

    for lab in labs:
        lower_name = lab.test_name.lower()
        if explanation_by_name.get(lower_name):
            lab.explanation = explanation_by_name[lower_name]
        if lab.status == "normal":
            normal_values.append(lab)
        else:
            abnormal_values.append(
                {
                    **lab.model_dump(),
                    "suggested_doctor_questions": suggested_questions(lab.test_name, lab.status),
                }
            )

    if abnormal_values:
        summary = f"Found {len(abnormal_values)} value(s) outside or not clearly comparable to the listed reference range."
    elif normal_values:
        summary = "The extracted values appear to be within the listed reference ranges."
    else:
        summary = "No clear blood test values could be extracted from the report text."

    if not discussion_points:
        discussion_points = [
            "Ask which results are most important for your age, sex, symptoms, and health history.",
            "Ask whether any result should be repeated or compared with prior reports.",
            "Ask what lifestyle or follow-up steps are appropriate for you.",
        ]

    return AnalysisResult(
        summary=summary,
        normal_values=normal_values,
        abnormal_values=abnormal_values,
        doctor_discussion_points=discussion_points[:6],
        safety_disclaimer=SAFETY_DISCLAIMER,
    )


def analyze_report_text(report_text: str, llm_client: LLMClient) -> AnalysisResult:
    engine = Engine(
        agents=[
            LabExtractionAgent(llm_client),
            AbnormalityAgent(llm_client),
            PatientExplanationAgent(llm_client),
            SafetyAgent(llm_client),
        ],
        aggregator=HealthReportAggregator(llm_client),
    )
    report = engine.run(report_text)
    return AnalysisResult.model_validate(report.consensus)
