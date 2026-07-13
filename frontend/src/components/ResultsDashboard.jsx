import React, { useRef, useState } from "react";
import ResultsTable from "./ResultsTable.jsx";

export default function ResultsDashboard({ analysis, labels }) {
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
        <p className="eyebrow">{labels.analysis}</p>
        <h2>{labels.resultsDashboard}</h2>
      </div>

      <div className="dashboardOverview">
        <div className="metricGrid">
          <article className="metricCard normalMetric">
            <span>{labels.normal}</span>
            <strong>{normalCount}</strong>
            <p>{labels.withinRange}</p>
          </article>
          <article className="metricCard abnormalMetric">
            <span>{labels.abnormal}</span>
            <strong>{abnormalCount}</strong>
            <p>{labels.abnormalDescription}</p>
          </article>
          <article className="metricCard totalMetric">
            <span>{labels.totalTests}</span>
            <strong>{totalCount}</strong>
            <p>{labels.extractedFromReport}</p>
          </article>
        </div>

        <aside className="breakdownCard" aria-label={labels.reportBreakdown}>
          <h3>{labels.reportBreakdown}</h3>
          <div className="donutChart" ref={chartRef}>
            <svg className="donutSvg" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="donutTrack" cx="60" cy="60" r="42" />
              {totalCount > 0 && (
                <>
                  <circle
                    className={`donutSegment normalSegment ${tooltip?.label === labels.normal ? "active" : ""}`}
                    cx="60"
                    cy="60"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${normalPercent} ${100 - normalPercent}`}
                    onPointerEnter={(event) => showTooltip(event, labels.normal, normalCount)}
                    onPointerMove={(event) => showTooltip(event, labels.normal, normalCount)}
                    onPointerDown={(event) => showTooltip(event, labels.normal, normalCount)}
                    onPointerLeave={hideTooltip}
                  />
                  <circle
                    className={`donutSegment abnormalSegment ${tooltip?.label === labels.abnormal ? "active" : ""}`}
                    cx="60"
                    cy="60"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${abnormalPercent} ${100 - abnormalPercent}`}
                    strokeDashoffset={-normalPercent}
                    onPointerEnter={(event) => showTooltip(event, labels.abnormal, abnormalCount)}
                    onPointerMove={(event) => showTooltip(event, labels.abnormal, abnormalCount)}
                    onPointerDown={(event) => showTooltip(event, labels.abnormal, abnormalCount)}
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
              {labels.normal} {normalCount}
            </span>
            <span>
              <i className="legendDot abnormalDot"></i>
              {labels.abnormal} {abnormalCount}
            </span>
          </div>
        </aside>
      </div>

      <section className="panel summaryPanel">
        <h3>{labels.summaryOfAnalysis}</h3>

        <div className="summaryGroup reviewGroup">
          <h4>{labels.needsReview}</h4>
          {reviewHighlights.length > 0 ? (
            <ul className="summaryList">
              {reviewHighlights.map((item, index) => (
                <li key={`review-${item.test_name}-${index}`}>
                  {labels.markedTemplate({
                    testName: item.test_name,
                    status: formatStatus(item.status),
                    value: formatValue(item),
                    range: formatRange(item.reference_range),
                  })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{labels.noReview}</p>
          )}
        </div>

        <div className="summaryGroup goodGroup">
          <h4>{labels.looksGood}</h4>
          {normalHighlights.length > 0 ? (
            <ul className="summaryList">
              {normalHighlights.map((item, index) => (
                <li key={`normal-${item.test_name}-${index}`}>
                  {labels.normalTemplate({
                    testName: item.test_name,
                    value: formatValue(item),
                  })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{labels.noNormal}</p>
          )}
        </div>

        <p className="summaryNote">{labels.summaryNote}</p>
      </section>

      <ResultsTable
        title={labels.labValues}
        values={allValues}
        emptyText={labels.noLabValues}
        labels={labels}
      />

      <section className="panel">
        <h3>{labels.doctorPoints}</h3>
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
