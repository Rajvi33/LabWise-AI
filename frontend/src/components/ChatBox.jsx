import React, { useState } from "react";

export default function ChatBox({ reportId }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I can help explain the uploaded blood report in simple educational language. Upload and analyze a PDF, then ask about values, reference ranges, or doctor discussion points.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const quickQuestions = [
    "Which values are abnormal?",
    "What should I ask my doctor?",
    "Is my cholesterol normal?",
  ];

  async function askQuestion(nextQuestion) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || !reportId || loading) return;

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/chat/${reportId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Chat request failed.");
      setMessages((current) => [...current, { role: "assistant", text: data.answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error.message }]);
    } finally {
      setLoading(false);
    }
  }

  function sendQuestion(event) {
    event.preventDefault();
    askQuestion(question);
  }

  return (
    <section className="panel chatPanel">
      <div className="chatHeader">
        <div>
          <p className="eyebrow">Report Chat</p>
          <h2>Ask the assistant</h2>
        </div>
        <span className={reportId ? "chatStatus ready" : "chatStatus"}>{reportId ? "Ready" : "Upload first"}</span>
      </div>
      <div className="quickQuestions">
        {quickQuestions.map((item) => (
          <button className="quickButton" type="button" key={item} onClick={() => askQuestion(item)} disabled={!reportId || loading}>
            {item}
          </button>
        ))}
      </div>
      <div className="chatHistory">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
            {message.text}
          </div>
        ))}
      </div>
      <form className="chatForm" onSubmit={sendQuestion}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Why is my hemoglobin low?"
          disabled={!reportId || loading}
        />
        <button type="submit" disabled={!reportId || loading}>
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
