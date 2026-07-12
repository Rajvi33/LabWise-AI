import React, { useRef, useState } from "react";
import ResultsTable from "./ResultsTable.jsx";

export default function ResultsDashboard({ analysis }) {
  const chartRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const normalValues = analysis?.normal_values || [];
  const abnormalValues = analysis?.abnormal_values || [];
  const allValues = [...abnormalValues, ...normalValues];
  const normalCount = normalValues.length;
  const abnormalCount = abnormalValues.length;
  const totalCount = allValues.length;
  const normalPercent = totalCount ? (normalCount / totalCount) * 100 : 0;
  const abnormalPercent = totalCount ? 100 - normalPercent : 0;
  const reviewHighlights = abnormalValues.slice(0, 2);
  const normalHighlights = normalValues.slice(0, 2);

  function showTooltip(event, label, count) {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return;

    setTooltip({
      label,
      count,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  }

  function hideTooltip(event) {
    if (event.pointerType === "touch") return;
    setTooltip(null);
  }

  return (
    <section className="dashboard">
      <div className="sectionHeader">
        <p className="eyebrow">Analysis</p>
        <h2>Results dashboard</h2>
      </div>

      <div className="dashboardOverview">
        <div className="metricGrid">
          <article className="metricCard normalMetric">
            <span>Normal</span>
            <strong>{normalCount}</strong>
            <p>Within listed range</p>
          </article>
          <article className="metricCard abnormalMetric">
            <span>Abnormal</span>
            <strong>{abnormalCount}</strong>
            <p>Low, high, unknown, or critical</p>
          </article>
          <article className="metricCard totalMetric">
            <span>Total Tests</span>
            <strong>{totalCount}</strong>
            <p>Extracted from report</p>
          </article>
        </div>

        <aside className="breakdownCard" aria-label="Report Breakdown">
          <h3>Report Breakdown</h3>
          <div className="donutChart" ref={chartRef}>
            <svg className="donutSvg" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="donutTrack" cx="60" cy="60" r="42" />
              {totalCount > 0 && (
                <>
                  <circle
                    className={`donutSegment normalSegment ${tooltip?.label === "Normal" ? "active" : ""}`}
                    cx="60"
                    cy="60"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${normalPercent} ${100 - normalPercent}`}
                    onPointerEnter={(event) => showTooltip(event, "Normal", normalCount)}
                    onPointerMove={(event) => showTooltip(event, "Normal", normalCount)}
                    onPointerDown={(event) => showTooltip(event, "Normal", normalCount)}
                    onPointerLeave={hideTooltip}
                  />
                  <circle
                    className={`donutSegment abnormalSegment ${tooltip?.label === "Abnormal" ? "active" : ""}`}
                    cx="60"
                    cy="60"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${abnormalPercent} ${100 - abnormalPercent}`}
                    strokeDashoffset={-normalPercent}
                    onPointerEnter={(event) => showTooltip(event, "Abnormal", abnormalCount)}
                    onPointerMove={(event) => showTooltip(event, "Abnormal", abnormalCount)}
                    onPointerDown={(event) => showTooltip(event, "Abnormal", abnormalCount)}
                    onPointerLeave={hideTooltip}
                  />
                </>
              )}
            </svg>
            <span className="donutTotal">{totalCount}</span>
            {tooltip && (
              <div className="chartTooltip" style={{ left: tooltip.x, top: tooltip.y }}>
                {tooltip.label}: {tooltip.count}
              </div>
            )}
          </div>
          <div className="chartLegend">
            <span>
              <i className="legendDot normalDot"></i>
              Normal {normalCount}
            </span>
            <span>
              <i className="legendDot abnormalDot"></i>
              Abnormal {abnormalCount}
            </span>
          </div>
        </aside>
      </div>

      <section className="panel summaryPanel">
        <h3>Summary of Analysis</h3>

        <div className="summaryGroup reviewGroup">
          <h4>Needs closer review</h4>
          {reviewHighlights.length > 0 ? (
            <ul className="summaryList">
              {reviewHighlights.map((item, index) => (
                <li key={`review-${item.test_name}-${index}`}>
                  {item.test_name} is marked {formatStatus(item.status)} at {formatValue(item)}, compared with the
                  listed range of {formatRange(item.reference_range)}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No extracted values were flagged for closer review based on the listed reference ranges.</p>
          )}
        </div>

        <div className="summaryGroup goodGroup">
          <h4>Looks good</h4>
          {normalHighlights.length > 0 ? (
            <ul className="summaryList">
              {normalHighlights.map((item, index) => (
                <li key={`normal-${item.test_name}-${index}`}>
                  {item.test_name} appears within the listed range at {formatValue(item)}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No clearly normal values were detected from the extracted results.</p>
          )}
        </div>

        <p className="summaryNote">
          Review the lab values table below for full details and discuss flagged results with a healthcare professional.
        </p>
      </section>

      <ResultsTable
        title="Lab Values"
        values={allValues}
        emptyText="No lab values were extracted yet."
      />

      <section className="panel">
        <h3>Doctor Discussion Points</h3>
        <ul className="discussionList">
          {(analysis.doctor_discussion_points || []).map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(item) {
  const unit = item.unit ? ` ${item.unit}` : "";
  return `${item.value ?? "not listed"}${unit}`;
}

function formatRange(referenceRange) {
  return referenceRange || "not found";
}
