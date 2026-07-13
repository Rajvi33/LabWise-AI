import React, { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function ChatBox({ reportId, labels }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: labels.chatWelcome,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const quickQuestions = labels.quickQuestions;

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0].role === "assistant") {
        return [{ role: "assistant", text: labels.chatWelcome }];
      }
      return current;
    });
  }, [labels.chatWelcome]);

  async function askQuestion(nextQuestion) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || !reportId || loading) return;

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/${reportId}`, {
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
          <p className="eyebrow">{labels.reportChat}</p>
          <h2>{labels.askAssistant}</h2>
        </div>
        <span className={reportId ? "chatStatus ready" : "chatStatus"}>
          {reportId ? labels.ready : labels.uploadFirst}
        </span>
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
          placeholder={labels.chatPlaceholder}
          disabled={!reportId || loading}
        />
        <button type="submit" disabled={!reportId || loading}>
          {loading ? labels.sending : labels.send}
        </button>
      </form>
    </section>
  );
}
