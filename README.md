# LabWise AI

LabWise AI is a simple MVP that helps users upload a blood report PDF, extract lab values, and understand which values appear normal, low, high, or unknown based on the reference ranges printed in the report.

It is designed to help diagnose and monitor diseases using patient data in an educational, safety-aware workflow.

The app includes a report-aware chatbot for educational questions about the uploaded report. It does not diagnose, prescribe medicine, suggest doses, or tell users to start or stop medicine.

**Medical safety disclaimer:** This is educational information only and not a medical diagnosis. Please consult a qualified healthcare professional for medical advice.

## Features

- Upload a blood report PDF
- Extract text from the PDF with PyMuPDF
- Analyze lab values with Octochains agents
- Extract test name, value, unit, reference range, status, and explanation
- Show summary, abnormal values, normal values, doctor discussion points, and disclaimer
- Chatbot answers questions using the uploaded report and analysis
- Safety refusal for diagnosis, medicine, dosing, and start/stop medication questions
- Mock mode when `OPENAI_API_KEY` is not configured

## Tech Stack

- Backend: Python, FastAPI, Octochains, PyMuPDF, OpenAI-compatible LLM API
- Frontend: React, Vite
- Storage: local uploaded files and in-memory report state

## Project Structure

```text
backend/
  main.py
  report_parser.py
  health_agents.py
  chatbot.py
  llm_client.py
  schemas.py
  uploads/

frontend/
  package.json
  src/
    App.jsx
    components/

src/octochains/
  Octochains framework package
```

## Setup

Create a Python virtual environment and install the backend requirements plus the local Octochains package:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -e .
```

Create your environment file:

```bash
cp .env.example .env
```

Set these values if you want live LLM analysis:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

If `OPENAI_API_KEY` is empty, the backend runs in mock mode with heuristic extraction so the demo still works.

## Run Backend

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## API Endpoints

### `GET /health`

Returns backend status and whether mock mode is active.

### `POST /upload-report`

Accepts a PDF file as multipart form data under `file`.

Returns:

```json
{
  "report_id": "...",
  "text_preview": "..."
}
```

### `POST /analyze-report/{report_id}`

Runs the Octochains agent workflow and returns:

```json
{
  "summary": "...",
  "normal_values": [
    {
      "test_name": "...",
      "value": "...",
      "unit": "...",
      "reference_range": "...",
      "status": "normal",
      "explanation": "..."
    }
  ],
  "abnormal_values": [
    {
      "test_name": "...",
      "value": "...",
      "unit": "...",
      "reference_range": "...",
      "status": "low",
      "explanation": "...",
      "suggested_doctor_questions": ["..."]
    }
  ],
  "doctor_discussion_points": ["..."],
  "safety_disclaimer": "This is educational information only and not a medical diagnosis. Please consult a qualified healthcare professional for medical advice."
}
```

### `POST /chat/{report_id}`

Accepts:

```json
{
  "question": "Which values are abnormal?"
}
```

Returns:

```json
{
  "answer": "...",
  "safety_disclaimer": "This is educational information only and not a medical diagnosis. Please consult a qualified healthcare professional for medical advice."
}
```

Unsafe medical advice questions are refused.

## Error Handling

- Non-PDF upload returns `400`
- PDF text extraction failure returns `422`
- Missing `report_id` returns `404`
- Invalid LLM JSON falls back to deterministic mock-style aggregation
- Unsafe chatbot questions return a safe refusal

## Octochains Agents

The analysis workflow uses these agents:

- `LabExtractionAgent`: extracts lab test names, values, units, and reference ranges
- `AbnormalityAgent`: classifies values as normal, low, high, or unknown
- `PatientExplanationAgent`: explains results in simple language
- `SafetyAgent`: enforces educational-only safety rules
- `HealthReportAggregator`: combines all agent outputs into the final report

## Future Improvements

- Add authenticated user accounts
- Store reports and analyses in a database
- Improve table extraction for complex lab report layouts
- Add support for image-only PDFs with OCR
- Add clinical reference range normalization by age and sex where appropriate
- Add export to PDF or shareable report summaries
