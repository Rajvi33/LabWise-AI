from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SAFETY_DISCLAIMER = (
    "This is educational information only and not a medical diagnosis. "
    "Please consult a qualified healthcare professional for medical advice."
)


Status = Literal["normal", "low", "high", "critical", "unknown"]


class LabValue(BaseModel):
    test_name: str
    value: str
    unit: str = ""
    reference_range: str = ""
    status: Status = "unknown"
    explanation: str = ""


class AbnormalLabValue(LabValue):
    suggested_doctor_questions: list[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    summary: str
    normal_values: list[LabValue] = Field(default_factory=list)
    abnormal_values: list[AbnormalLabValue] = Field(default_factory=list)
    doctor_discussion_points: list[str] = Field(default_factory=list)
    safety_disclaimer: str = SAFETY_DISCLAIMER


class UploadResponse(BaseModel):
    report_id: str
    text_preview: str


class ChatRequest(BaseModel):
    question: str
    lab_results: list[dict[str, Any]] = Field(default_factory=list, alias="labResults")
    summary: dict[str, Any] | str | None = None
    language: str = "auto"
    has_report: bool = Field(default=False, alias="hasReport")

    model_config = ConfigDict(populate_by_name=True)


class ChatResponse(BaseModel):
    answer: str
    safety_disclaimer: str = SAFETY_DISCLAIMER
