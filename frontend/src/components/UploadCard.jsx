import React, { useRef, useState } from "react";

export default function UploadCard({
  file,
  onFileSelect,
  onUpload,
  onAnalyze,
  reportReady,
  uploadLoading,
  analyzeLoading,
  labels,
}) {
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
          <h2>{labels.uploadTitle}</h2>
          <p>{labels.uploadHelp}</p>
          <span className="fileName">{file ? file.name : labels.pdfOnly}</span>
        </div>
      </div>

      <div className="uploadActions">
        <button onClick={onUpload} disabled={!file || uploadLoading || analyzeLoading}>
          {uploadLoading ? labels.uploading : labels.uploadReport}
        </button>
        <button className="secondary" onClick={onAnalyze} disabled={!reportReady || uploadLoading || analyzeLoading}>
          {analyzeLoading ? labels.analyzing : labels.analyzeReport}
        </button>
      </div>
    </section>
  );
}
