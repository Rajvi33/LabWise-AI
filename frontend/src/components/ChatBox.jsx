import React, { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const CHAT_ERROR_MESSAGE = "I couldn’t connect to the AI assistant. Please check the backend Gemini setup and try again.";

export default function ChatBox({ reportId, analysis, language, labels }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: labels.chatWelcome,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const quickQuestions = labels.quickQuestions;
  const labResults = analysis ? [...(analysis.abnormal_values || []), ...(analysis.normal_values || [])] : [];
  const hasReport = Boolean(reportId && analysis && labResults.length);
  const statusText = hasReport ? labels.reportReady || "Report ready" : labels.generalMode || "General mode";

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
    if (!trimmed || loading) return;

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          labResults: hasReport ? labResults : [],
          summary: analysis
            ? {
                summary: analysis.summary,
                normalCount: analysis.normal_values?.length || 0,
                abnormalCount: analysis.abnormal_values?.length || 0,
                doctorDiscussionPoints: analysis.doctor_discussion_points || [],
              }
            : {},
          language: language || "auto",
          hasReport,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Chat request failed.");
      setMessages((current) => [...current, { role: "assistant", text: data.answer }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: CHAT_ERROR_MESSAGE }]);
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
        <span className={hasReport ? "chatStatus ready" : "chatStatus"}>
          {statusText}
        </span>
      </div>
      <div className="quickQuestions">
        {quickQuestions.map((item) => (
          <button className="quickButton" type="button" key={item} onClick={() => askQuestion(item)} disabled={loading}>
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
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? labels.thinking || "Thinking..." : labels.send}
        </button>
      </form>
    </section>
  );
}
