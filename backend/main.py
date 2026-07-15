from pathlib import Path
from uuid import uuid4
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .chatbot import GeminiChatError, answer_question, answer_report_question
from .health_agents import analyze_report_text
from .llm_client import LLMClient
from .report_parser import ReportParsingError, extract_text_from_pdf
from .schemas import AnalysisResult, ChatRequest, ChatResponse, UploadResponse


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Health Report Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

llm_client = LLMClient()
REPORTS: dict[str, dict[str, object]] = {}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Invalid request body for %s: %s", request.url.path, exc.errors())
    return JSONResponse(status_code=422, content={"detail": "Invalid request body."})


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "service": "AI Health Report Assistant", "mock_mode": llm_client.mock_mode}


@app.post("/upload-report", response_model=UploadResponse)
async def upload_report(file: UploadFile = File(...)) -> UploadResponse:
    if file.content_type != "application/pdf" and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    report_id = str(uuid4())
    path = UPLOAD_DIR / f"{report_id}.pdf"
    path.write_bytes(await file.read())

    try:
        text = extract_text_from_pdf(path)
    except ReportParsingError as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    REPORTS[report_id] = {"path": str(path), "text": text, "analysis": None}
    return UploadResponse(report_id=report_id, text_preview=text[:1200])


@app.post("/analyze-report/{report_id}", response_model=AnalysisResult)
def analyze_report(report_id: str) -> AnalysisResult:
    report = REPORTS.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="report_id not found.")

    analysis = analyze_report_text(str(report["text"]), llm_client)
    report["analysis"] = analysis
    return analysis


@app.post("/chat/{report_id}", response_model=ChatResponse)
def chat(report_id: str, request: ChatRequest) -> ChatResponse:
    report = REPORTS.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="report_id not found.")

    analysis = report.get("analysis")
    answer = answer_question(
        request.question,
        str(report["text"]),
        analysis if isinstance(analysis, AnalysisResult) else None,
        llm_client,
    )
    return ChatResponse(answer=answer)


@app.post("/api/chat", response_model=ChatResponse)
def api_chat(request: ChatRequest) -> ChatResponse:
    try:
        answer = answer_report_question(
            request.question,
            request.lab_results,
            request.summary,
            request.language,
            request.has_report,
        )
    except GeminiChatError as exc:
        logger.error("POST /api/chat failed: %s", exc)
        raise HTTPException(status_code=503, detail="AI assistant is not available right now.") from exc

    return ChatResponse(answer=answer)
