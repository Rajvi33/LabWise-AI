from .health_agents import classify_value, heuristic_extract_labs
from .llm_client import LLMClient
from .schemas import AnalysisResult, SAFETY_DISCLAIMER


UNSAFE_PATTERNS = [
    "what disease",
    "diagnose",
    "diagnosis",
    "what medicine",
    "which medicine",
    "dose",
    "dosage",
    "prescribe",
    "should i stop",
    "stop my medicine",
    "start medicine",
    "start medication",
    "stop medication",
]


def is_unsafe_question(question: str) -> bool:
    lower = question.lower()
    return any(pattern in lower for pattern in UNSAFE_PATTERNS)


def safe_refusal() -> str:
    return (
        "I cannot diagnose conditions, prescribe medicine, suggest doses, or tell you to start or stop medicine. "
        "I can help explain the uploaded report in simple educational terms and suggest questions to ask your healthcare professional."
    )


def mock_chat_answer(question: str, report_text: str, analysis: AnalysisResult | None) -> str:
    lower = question.lower()
    if analysis and ("abnormal" in lower or "which values" in lower):
        if not analysis.abnormal_values:
            return "I do not see extracted values marked as high, low, or unknown in the current analysis."
        names = ", ".join(f"{item.test_name} ({item.status})" for item in analysis.abnormal_values)
        return f"The values flagged for discussion are: {names}."

    for lab in heuristic_extract_labs(report_text):
        if lab["test_name"].lower() in lower or any(part in lower for part in lab["test_name"].lower().split()):
            status = classify_value(lab["value"], lab["reference_range"])
            return (
                f"{lab['test_name']} is listed as {lab['value']} {lab.get('unit', '')}. "
                f"Compared with the report reference range ({lab.get('reference_range') or 'not found'}), "
                f"its status is {status}."
            )

    if "doctor" in lower or "ask" in lower:
        points = analysis.doctor_discussion_points if analysis else []
        if points:
            return "Good questions to ask include: " + " ".join(f"{idx + 1}. {point}" for idx, point in enumerate(points))

    return "I can answer questions about extracted values, abnormal flags, reference ranges, and what to discuss with your doctor."


def answer_question(
    question: str,
    report_text: str,
    analysis: AnalysisResult | None,
    llm_client: LLMClient,
) -> str:
    if is_unsafe_question(question):
        return safe_refusal()

    if llm_client.mock_mode:
        return mock_chat_answer(question, report_text, analysis)

    analysis_json = analysis.model_dump_json(indent=2) if analysis else "No completed analysis yet."
    prompt = f"""
Answer the user's question using only the uploaded report text and analysis.
Be simple, educational, and safe.
Do not diagnose, prescribe, recommend medicine doses, or tell the user to start/stop medicine.
If the question requires medical advice, refuse briefly and suggest consulting a qualified healthcare professional.
End with this exact disclaimer: {SAFETY_DISCLAIMER}

Question:
{question}

Analysis:
{analysis_json}

Report text:
{report_text[:12000]}
"""
    return llm_client.complete(prompt, json_mode=False).strip()
