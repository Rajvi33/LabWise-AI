import React from "react";

export default function ResultsTable({ title, values, emptyText }) {
  return (
    <section className="panel tablePanel">
      <h3>{title}</h3>
      {values.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Value</th>
                <th>Reference Range</th>
                <th>Status</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {values.map((item, index) => (
                <tr key={`${item.test_name}-${index}`}>
                  <td>{item.test_name}</td>
                  <td>
                    {item.value} {item.unit}
                  </td>
                  <td>{item.reference_range || "Not found"}</td>
                  <td>
                    <span className={`status ${item.status}`}>{formatStatus(item.status)}</span>
                  </td>
                  <td>{item.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
