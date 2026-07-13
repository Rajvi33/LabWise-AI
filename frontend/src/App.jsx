import React, { useState } from "react";
import ChatBox from "./components/ChatBox.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import ResultsDashboard from "./components/ResultsDashboard.jsx";
import UploadCard from "./components/UploadCard.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const DISCLAIMER =
  "This is educational information only and not a medical diagnosis. Please consult a qualified healthcare professional for medical advice.";

export default function App() {
  const [file, setFile] = useState(null);
  const [reportId, setReportId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  async function uploadReport() {
    if (!file) {
      setError("Choose a PDF blood report first.");
      return;
    }

    setError("");
    setAnalysis(null);
    setUploadLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-report`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Upload failed.");
      setReportId(data.report_id);
    } catch (event) {
      setError(event.message);
    } finally {
      setUploadLoading(false);
    }
  }

  async function analyzeReport() {
    if (!reportId) {
      setError("Upload a report before analyzing.");
      return;
    }

    setError("");
    setAnalyzeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-report/${reportId}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Analysis failed.");
      setAnalysis(data);
    } catch (event) {
      setError(event.message);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  return (
    <main className="appShell">
      <section className="hero">
        <div className="heroContent">
          <h1>Labwise AI</h1>
          <p>Understand your blood report in minutes.</p>
        </div>
        <div className="heroIllustration" aria-hidden="true">
          <img src="/labwise-hero.svg" alt="" />
        </div>
      </section>

      <HowItWorks />

      <div className="workspaceGrid">
        <div>
          <UploadCard
            file={file}
            onFileSelect={setFile}
            onUpload={uploadReport}
            onAnalyze={analyzeReport}
            reportReady={Boolean(reportId)}
            uploadLoading={uploadLoading}
            analyzeLoading={analyzeLoading}
          />
        </div>

        <ChatBox reportId={reportId} />
      </div>

      {(uploadLoading || analyzeLoading) && (
        <div className="notice">{uploadLoading ? "Uploading report..." : "Analyzing report..."}</div>
      )}
      {error && <div className="error">{error}</div>}

      {analysis ? <ResultsDashboard analysis={analysis} /> : <EmptyDashboard />}

      <footer className="disclaimer">{analysis?.safety_disclaimer || DISCLAIMER}</footer>
    </main>
  );
}

function EmptyDashboard() {
  return (
    <section className="emptyDashboard">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h2>Your lab value summary will appear here</h2>
        <p>Upload and analyze a PDF to see normal, abnormal, and total extracted values.</p>
      </div>
    </section>
  );
}
