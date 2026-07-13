import React from "react";

export default function HowItWorks({ labels }) {
  const steps = labels.steps.map(([title, text], index) => ({
    title,
    text,
    icon: String(index + 1).padStart(2, "0"),
  }));

  return (
    <section className="howItWorks">
      <div className="sectionHeader">
        <p className="eyebrow">{labels.workflowEyebrow}</p>
        <h2>{labels.howItWorks}</h2>
      </div>
      <div className="stepGrid">
        {steps.map((step) => (
          <article className="stepCard" key={step.title}>
            <span>{step.icon}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
