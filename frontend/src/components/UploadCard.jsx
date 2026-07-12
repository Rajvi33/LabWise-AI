import React, { useRef, useState } from "react";

export default function UploadCard({ file, onFileSelect, onUpload, onAnalyze, reportReady, uploadLoading, analyzeLoading }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  function selectFile(nextFile) {
    if (nextFile) onFileSelect(nextFile);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  return (
    <section className="uploadCard">
      <div
        className={`dropZone ${dragActive ? "active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          className="fileInput"
          type="file"
          accept="application/pdf"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <div className="uploadIcon">+</div>
        <div>
          <h2>Upload blood report PDF</h2>
          <p>Drag and drop your report here, or click to browse.</p>
          <span className="fileName">{file ? file.name : "PDF files only"}</span>
        </div>
      </div>

      <div className="uploadActions">
        <button onClick={onUpload} disabled={!file || uploadLoading || analyzeLoading}>
          {uploadLoading ? "Uploading..." : "Upload Report"}
        </button>
        <button className="secondary" onClick={onAnalyze} disabled={!reportReady || uploadLoading || analyzeLoading}>
          {analyzeLoading ? "Analyzing..." : "Analyze Report"}
        </button>
      </div>
    </section>
  );
}
