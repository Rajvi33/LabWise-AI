import React from "react";

const steps = [
  {
    title: "Upload Report",
    text: "Add a blood report PDF from your device.",
    icon: "01",
  },
  {
    title: "Extract Lab Values",
    text: "The backend reads the PDF and organizes test values.",
    icon: "02",
  },
  {
    title: "Ask Questions",
    text: "Chat about the uploaded report in simple educational language.",
    icon: "03",
  },
];

export default function HowItWorks() {
  return (
    <section className="howItWorks">
      <div className="sectionHeader">
        <p className="eyebrow">Workflow</p>
        <h2>How it works</h2>
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
