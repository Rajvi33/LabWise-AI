import json
import logging
import os
from typing import Any

from .health_agents import classify_value, heuristic_extract_labs
from .llm_client import LLMClient
from .schemas import AnalysisResult, SAFETY_DISCLAIMER

logger = logging.getLogger(__name__)

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


class GeminiChatError(RuntimeError):
    pass


def is_unsafe_question(question: str) -> bool:
    lower = question.lower()
    return any(pattern in lower for pattern in UNSAFE_PATTERNS)


def safe_refusal() -> str:
    return (
        "I cannot diagnose conditions, prescribe medicine, suggest doses, or tell you to start or stop medicine. "
        "I can help explain the uploaded report in simple educational terms and suggest questions to ask your healthcare professional."
    )


def greeting_reply(question: str, language: str, has_report: bool) -> str | None:
    normalized = question.lower().strip(" .,!?\n\t")
    greetings = {
        "hi",
        "hello",
        "hey",
        "namaste",
        "namaskar",
        "kem cho",
        "કેમ છો",
        "હાય",
        "નમસ્તે",
    }
    if normalized not in greetings:
        return None

    lang = (language or "auto").lower()
    if normalized in {"kem cho", "કેમ છો", "હાય", "નમસ્તે"} or lang == "gu":
        return (
            "મજામાં. હું LabWise AI છું.\n"
            + ("તમારી રિપોર્ટ તૈયાર છે. કોઈપણ મૂલ્ય વિશે પૂછો." if has_report else "તમે મને બ્લડ રિપોર્ટ વિશે સામાન્ય પ્રશ્નો પૂછી શકો છો.")
        )
    if normalized in {"namaste", "namaskar"} or lang == "hi":
        return (
            "नमस्ते. मैं LabWise AI हूं.\n"
            + ("आपकी रिपोर्ट तैयार है. किसी भी वैल्यू के बारे में पूछें." if has_report else "आप मुझसे ब्लड रिपोर्ट के सामान्य सवाल पूछ सकते हैं.")
        )
    return (
        "Hello. I’m LabWise AI.\n"
        + ("Your report is ready. Ask me about any value." if has_report else "You can ask me general blood report questions, or upload a report for personalized explanations.")
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


def answer_report_question(
    question: str,
    lab_results: list[dict[str, Any]],
    summary: dict[str, Any] | str | None,
    language: str = "en",
    has_report: bool = False,
) -> str:
    if is_unsafe_question(question):
        return safe_refusal()

    report_mode = has_report and bool(lab_results)
    greeting = greeting_reply(question, language, report_mode)
    if greeting:
        return greeting

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.error("Gemini chat failed: missing GEMINI_API_KEY.")
        raise GeminiChatError("GEMINI_API_KEY is not configured.")

    try:
        from google import genai
    except Exception as exc:
        logger.exception("Gemini chat failed: google-genai SDK is not installed or could not be imported.")
        raise GeminiChatError("Gemini SDK is not installed.") from exc

    prompt = build_gemini_prompt(question, lab_results, summary, language, report_mode)

    try:
        client = genai.Client(api_key=api_key)
        model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip() or "gemini-3.5-flash"
        if hasattr(client, "interactions"):
            response = client.interactions.create(model=model, input=prompt)
            answer = (getattr(response, "output_text", "") or "").strip()
        else:
            response = client.models.generate_content(model=model, contents=prompt)
            answer = (getattr(response, "text", "") or "").strip()
    except Exception as exc:
        logger.exception("Gemini chat failed during API request.")
        raise GeminiChatError("Gemini request failed.") from exc

    if not answer:
        logger.error("Gemini chat failed: empty response from Gemini.")
        raise GeminiChatError("Gemini returned an empty response.")
    return answer


def build_gemini_prompt(
    question: str,
    lab_results: list[dict[str, Any]],
    summary: dict[str, Any] | str | None,
    language: str,
    report_mode: bool,
) -> str:
    language_name = language_display_name(language)
    lab_results_json = json.dumps(lab_results, ensure_ascii=False, indent=2)
    summary_json = json.dumps(summary or {}, ensure_ascii=False, indent=2)
    mode_name = "REPORT MODE" if report_mode else "GENERAL MODE"

    return f"""
You are LabWise AI, a safe educational health report assistant.
Reply like a helpful human assistant. Be simple, friendly, and natural.
Keep most answers short unless the user asks for details.

Current mode: {mode_name}

You have two modes:

GENERAL MODE:
- Used when no report has been uploaded or analyzed.
- Answer general educational questions about lab tests and health reports.
- Briefly mention that no uploaded report has been analyzed yet only when it helps the answer.
- Do not make assumptions about the patient's values.

REPORT MODE:
- Used when uploaded report data is provided.
- Use the uploaded lab results as the main context.
- Explain values using the patient's report data.
- Mention value, unit, reference range, and status when available.
- If something is not present in the report, say it is not available in the uploaded report.
- If a value is low or high, explain in simple language what that type of result may commonly be associated with, without diagnosing.

Safety rules:
- Do not diagnose the user.
- Do not prescribe medicine.
- Do not suggest medication names or doses.
- Do not tell the user to start or stop medicine.
- Do not create panic.
- If the answer requires medical judgment, use one short sentence saying they should discuss it with a qualified doctor.
- Keep the tone clear, calm, and educational.
- Do not repeat long safety disclaimers.
- Do not add a disclaimer unless medically necessary.

Length rules:
- Greetings like hi, hello, hey, namaste, or kem cho: 1-2 short sentences only.
- Simple questions: 3-5 sentences maximum.
- Report-specific answers: give a short explanation with value, unit, reference range, status, and what it may mean.
- Detailed answers only when the user asks for details.
- Avoid bold markdown unless really needed.

Language:
- Understand questions in any language.
- If the selected language is auto, detect the user's language and reply in the same language.
- If a specific language is selected, reply in that language.
- Selected language: {language_name}.
- Support Gujarati, Hindi, English, French, Spanish, and other languages as much as possible.
- Keep medical test names readable, for example Hemoglobin, WBC, RBC, Platelets, Cholesterol, Glucose, TSH.

Uploaded report lab results:
{lab_results_json}

Analysis summary:
{summary_json}

User question:
{question}
""".strip()


def language_display_name(language: str) -> str:
    return {
        "auto": "auto",
        "en": "English",
        "hi": "Hindi",
        "gu": "Gujarati",
        "fr": "French",
        "es": "Spanish",
    }.get((language or "en").lower(), "English")
