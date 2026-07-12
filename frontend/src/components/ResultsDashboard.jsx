import React from "react";
import ResultsTable from "./ResultsTable.jsx";

export default function ResultsDashboard({ analysis }) {
  const normalValues = analysis?.normal_values || [];
  const abnormalValues = analysis?.abnormal_values || [];
  const allValues = [...abnormalValues, ...normalValues];

  return (
    <section className="dashboard">
      <div className="sectionHeader">
        <p className="eyebrow">Analysis</p>
        <h2>Results dashboard</h2>
      </div>

      <div className="metricGrid">
        <article className="metricCard normalMetric">
          <span>Normal</span>
          <strong>{normalValues.length}</strong>
          <p>Within listed range</p>
        </article>
        <article className="metricCard abnormalMetric">
          <span>Abnormal</span>
          <strong>{abnormalValues.length}</strong>
          <p>Low, high, unknown, or critical</p>
        </article>
        <article className="metricCard totalMetric">
          <span>Total Tests</span>
          <strong>{allValues.length}</strong>
          <p>Extracted from report</p>
        </article>
      </div>

      <section className="panel summaryPanel">
        <h3>Summary</h3>
        <p>{analysis.summary}</p>
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
