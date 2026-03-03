import { useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.REACT_APP_GROQ_KEY;
const NEWS_API_KEY = process.env.REACT_APP_NEWS_KEY;

async function fetchRealNews(topic) {
  const targetUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&sortBy=publishedAt&pageSize=12&language=en&apiKey=${NEWS_API_KEY}`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("Failed to fetch news. Proxy may be down.");
  const data = await res.json();
  if (data.status !== "ok") throw new Error("NewsAPI: " + (data.message || data.status));
  const articles = data.articles.filter(a => a.title && a.title !== "[Removed]");
  if (articles.length === 0) throw new Error("No articles found. Try a different topic.");
  return articles.slice(0, 12).map(a => ({
    title: a.title,
    source: a.source?.name || "Unknown",
    publishedAt: a.publishedAt,
    url: a.url,
  }));
}

async function analyzeSentiment(headlines) {
  const headlineList = headlines.map((h, i) => `${i + 1}. "${h.title}"`).join("\n");
  const prompt = `You are a financial and news sentiment analyst.

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "index": 1,
    "score": 0.85,
    "label": "positive",
    "emotion": "optimistic",
    "confidence": 0.92,
    "impact": 0.78,
    "summary": "one sentence reason"
  }
]

Rules:
- score: -1.0 to 1.0
- label: "positive", "negative", or "neutral"
- emotion: one word
- confidence: 0.0 to 1.0
- impact: 0.0 to 1.0
- Return exactly ${headlines.length} objects

Headlines:
${headlineList}`;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 2000, temperature: 0.1, messages: [{ role: "user", content: prompt }] })
  });
  const data = await res.json();
  if (data.error) throw new Error("Groq: " + data.error.message);
  const text = data.choices?.[0]?.message?.content || "[]";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function generateInsights(topic, enriched, metrics) {
  const summaryData = enriched.map(h => ({
    headline: h.title, score: h.score, label: h.label,
    confidence: h.confidence, impact: h.impact, emotion: h.emotion,
  }));
  const prompt = `You are a senior financial intelligence analyst. Based on this sentiment analysis data for the topic "${topic}", generate a structured intelligence report.

Sentiment Data:
${JSON.stringify(summaryData, null, 2)}

Computed Metrics:
- Average Sentiment Score: ${metrics.avgScore}
- Sentiment Volatility (std dev): ${metrics.volatility}
- Momentum (score trend): ${metrics.momentum}
- Market Mood: ${metrics.mood}
- Most Impactful Article: "${metrics.topArticle?.title}"

Return ONLY valid JSON, no markdown:
{
  "executive_summary": "2-3 sentence analytical summary explaining the overall sentiment landscape, what's driving it, and what it means. Be specific about numbers.",
  "key_insight": "One sharp, specific insight that a business analyst would find valuable",
  "risk_flag": "One sentence about the biggest risk or concern in this news landscape, or null if none",
  "opportunity": "One sentence about a positive signal or opportunity, or null if none",
  "top_article_explanation": "One sentence explaining why the most impactful article matters for this topic",
  "momentum_interpretation": "One sentence interpreting what the momentum trend means",
  "confidence_level": "high"
}`;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 1000, temperature: 0.3, messages: [{ role: "user", content: prompt }] })
  });
  const data = await res.json();
  if (data.error) throw new Error("Groq Insights: " + data.error.message);
  const text = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function computeMetrics(enriched) {
  const scores = enriched.map(h => h.score || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
  const volatility = Math.sqrt(variance);
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const num = scores.reduce((a, b, i) => a + (i - xMean) * (b - avg), 0);
  const den = scores.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  const momentum = den !== 0 ? num / den : 0;
  const mood = avg >= 0.2 ? "Bullish 📈" : avg <= -0.2 ? "Bearish 📉" : "Stable ⚖️";
  const moodColor = avg >= 0.2 ? "#00e5a0" : avg <= -0.2 ? "#ff4d6d" : "#ffd166";
  const topArticle = [...enriched].sort((a, b) =>
    ((b.impact || 0) * (b.confidence || 0)) - ((a.impact || 0) * (a.confidence || 0))
  )[0];
  const trendData = scores.map((score, i) => {
    const window = scores.slice(Math.max(0, i - 1), i + 2);
    const ma = window.reduce((a, b) => a + b, 0) / window.length;
    return { name: `#${i + 1}`, score: parseFloat(score.toFixed(2)), ma: parseFloat(ma.toFixed(2)) };
  });
  return { avgScore: parseFloat(avg.toFixed(3)), volatility: parseFloat(volatility.toFixed(3)), momentum: parseFloat(momentum.toFixed(3)), mood, moodColor, topArticle, trendData };
}

const scoreColor = s => s >= 0.3 ? "#00e5a0" : s <= -0.3 ? "#ff4d6d" : "#ffd166";
const labelBg = l => l === "positive" ? "rgba(0,229,160,0.1)" : l === "negative" ? "rgba(255,77,109,0.1)" : "rgba(255,209,102,0.1)";
const labelColor = l => l === "positive" ? "#00e5a0" : l === "negative" ? "#ff4d6d" : "#ffd166";
const fmtDate = iso => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
const fmtTime = iso => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function App() {
  const [topic, setTopic] = useState("artificial intelligence");
  const [headlines, setHeadlines] = useState([]);
  const [sentiments, setSentiments] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [lastTopic, setLastTopic] = useState("");

  const enriched = headlines.map((h, i) => ({ ...h, ...(sentiments[i] || {}) }));
  const positive = enriched.filter(h => h.label === "positive");
  const negative = enriched.filter(h => h.label === "negative");
  const neutral = enriched.filter(h => h.label === "neutral");
  const pieData = [
    { name: "Positive", value: positive.length, color: "#00e5a0" },
    { name: "Neutral", value: neutral.length, color: "#ffd166" },
    { name: "Negative", value: negative.length, color: "#ff4d6d" },
  ].filter(d => d.value > 0);

  const run = useCallback(async () => {
    setError(""); setHeadlines([]); setSentiments([]); setMetrics(null); setInsights(null);
    setLoading(true);
    if (!GROQ_API_KEY) { setError("❌ REACT_APP_GROQ_KEY missing from .env"); setLoading(false); return; }
    if (!NEWS_API_KEY) { setError("❌ REACT_APP_NEWS_KEY missing from .env"); setLoading(false); return; }
    try {
      setPhase("fetching");
      const news = await fetchRealNews(topic);
      setHeadlines(news);
      setLastTopic(topic);
      setPhase("analyzing");
      const results = await analyzeSentiment(news);
      setSentiments(results);
      const enrichedNow = news.map((h, i) => ({ ...h, ...(results[i] || {}) }));
      const m = computeMetrics(enrichedNow);
      setMetrics(m);
      setPhase("insights");
      const ins = await generateInsights(topic, enrichedNow, m);
      setInsights(ins);
      setPhase("done");
    } catch (e) {
      setError("Error: " + e.message);
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }, [topic]);

  const card = { background: "rgba(255,255,255,0.03)", border: "1px solid #1e2230", borderRadius: 12, padding: 24 };
  const TOPICS = ["artificial intelligence", "stock market", "climate change", "bitcoin", "ukraine", "healthcare"];
  const phaseLabel = { fetching: "⬇ Fetching live news...", analyzing: "🧠 Analyzing sentiment...", insights: "💡 Generating intelligence report..." };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c10", color: "#e8eaf0", fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap'); *{box-sizing:border-box;} a{color:inherit;} input:focus{outline:none;border-color:#00e5a0!important;}`}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2230", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#00e5a0,#0090ff)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>SentimentIQ</div>
            <div style={{ fontSize: 11, color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase" }}>AI News Intelligence System</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {phase === "done" && <span style={{ fontSize: 11, color: "#00e5a0", background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 20, padding: "4px 12px" }}>● LIVE</span>}
          <span style={{ fontSize: 11, color: "#4a5568", background: "rgba(255,255,255,0.04)", border: "1px solid #1e2230", borderRadius: 20, padding: "4px 12px" }}>Groq AI + NewsAPI</span>
        </div>
      </div>

      <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>

        {/* ── CONFIG ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a5568", marginBottom: 14 }}>⚙ Intelligence Configuration</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {TOPICS.map(t => (
              <button key={t} onClick={() => setTopic(t)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${topic === t ? "#00e5a0" : "#2a2f3e"}`, background: topic === t ? "rgba(0,229,160,0.1)" : "transparent", color: topic === t ? "#00e5a0" : "#4a5568", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer" }}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} placeholder="Type any topic..." style={{ background: "#0f1117", border: "1px solid #2a2f3e", borderRadius: 8, padding: "10px 14px", color: "#e8eaf0", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, width: 260 }} />
            <button onClick={run} disabled={loading} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#00e5a0,#0090ff)", color: "#0a0c10", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? phaseLabel[phase] || "Working..." : "▶ Run Intelligence"}
            </button>
          </div>
        </div>

        {error && <div style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.3)", borderRadius: 10, padding: "14px 20px", color: "#ff4d6d", fontSize: 13, marginBottom: 20, wordBreak: "break-all" }}>⚠ {error}</div>}

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#4a5568" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>{phase === "fetching" ? "⬇" : phase === "insights" ? "💡" : "🧠"}</div>
            <div style={{ fontSize: 14, color: "#8892a4" }}>{phaseLabel[phase]}</div>
            <div style={{ fontSize: 12, marginTop: 8, color: "#2a2f3e" }}>
              {phase === "insights" ? "Reasoning across all data points..." : phase === "analyzing" ? "Scoring sentiment + confidence + impact..." : `Fetching latest news about "${topic}"...`}
            </div>
          </div>
        )}

        {metrics && !loading && (
          <>
            <div style={{ marginBottom: 20, fontSize: 13, color: "#4a5568" }}>
              Intelligence report for: <span style={{ color: "#00e5a0", fontWeight: 700 }}>"{lastTopic}"</span>
            </div>

            {/* ── 1. METRICS ROW ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { val: enriched.length, label: "Headlines", color: "#e8eaf0" },
                { val: metrics.avgScore > 0 ? "+" + metrics.avgScore : metrics.avgScore, label: "Avg Score", color: scoreColor(metrics.avgScore) },
                { val: metrics.volatility, label: "Volatility", color: metrics.volatility > 0.4 ? "#ff4d6d" : "#ffd166" },
                { val: (metrics.momentum > 0 ? "↑ +" : "↓ ") + metrics.momentum, label: "Momentum", color: metrics.momentum > 0 ? "#00e5a0" : "#ff4d6d" },
                { val: metrics.mood, label: "Market Mood", color: metrics.moodColor },
                { val: positive.length + "/" + enriched.length, label: "Positive Rate", color: "#00e5a0" },
              ].map((s, i) => (
                <div key={i} style={{ ...card, textAlign: "center", padding: "16px 10px" }}>
                  <div style={{ fontSize: i === 4 ? 14 : 22, fontWeight: 700, color: s.color, letterSpacing: i === 4 ? 0 : "-0.02em" }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── 2. CHARTS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 20 }}>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a5568", marginBottom: 20 }}>📈 Sentiment Trend + Moving Average</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={metrics.trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                    <XAxis dataKey="name" tick={{ fill: "#4a5568", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                    <YAxis domain={[-1, 1]} tick={{ fill: "#4a5568", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                    <Tooltip contentStyle={{ background: "#0f1117", border: "1px solid #2a2f3e", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" stroke="#0090ff" strokeWidth={1.5} dot={{ fill: "#0090ff", r: 3 }} name="Score" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="ma" stroke="#00e5a0" strokeWidth={2.5} dot={false} name="Moving Avg" />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: "#0090ff" }}>── Raw Score</span>
                  <span style={{ fontSize: 11, color: "#00e5a0" }}>── Moving Avg</span>
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a5568", marginBottom: 20 }}>🥧 Distribution</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "#8892a4" }} />
                    <Tooltip contentStyle={{ background: "#0f1117", border: "1px solid #2a2f3e", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── 3. TOP IMPACT ARTICLE ── */}
            {metrics.topArticle && (
              <div style={{ ...card, marginBottom: 20, borderColor: "rgba(255,209,102,0.3)", background: "rgba(255,209,102,0.03)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffd166", marginBottom: 12 }}>⚡ Most Impactful Article</div>
                <div style={{ fontSize: 14, color: "#e8eaf0", lineHeight: 1.5, marginBottom: 8 }}>
                  {metrics.topArticle.url ? <a href={metrics.topArticle.url} target="_blank" rel="noreferrer" style={{ color: "#e8eaf0", textDecoration: "none" }}>{metrics.topArticle.title}</a> : metrics.topArticle.title}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: insights?.top_article_explanation ? 10 : 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#4a5568" }}>{metrics.topArticle.source}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${scoreColor(metrics.topArticle.score)}18`, color: scoreColor(metrics.topArticle.score), fontWeight: 700 }}>Score: {metrics.topArticle.score > 0 ? "+" : ""}{metrics.topArticle.score?.toFixed(2)}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(255,209,102,0.1)", color: "#ffd166" }}>Impact: {((metrics.topArticle.impact || 0) * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(0,144,255,0.1)", color: "#0090ff" }}>Confidence: {((metrics.topArticle.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
                {insights?.top_article_explanation && (
                  <div style={{ fontSize: 12, color: "#ffd166", fontStyle: "italic", padding: "10px 14px", background: "rgba(255,209,102,0.05)", borderRadius: 6, borderLeft: "3px solid rgba(255,209,102,0.4)" }}>
                    💡 {insights.top_article_explanation}
                  </div>
                )}
              </div>
            )}

            {/* ── 4. HIGHLIGHTS ── */}
            {enriched.length > 0 && (() => {
              const best = [...enriched].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
              const worst = [...enriched].sort((a, b) => (a.score || 0) - (b.score || 0))[0];
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  {[{ type: "positive", label: "🟢 Most Positive", item: best }, { type: "negative", label: "🔴 Most Negative", item: worst }].map(({ type, label, item }) => (
                    <div key={type} style={{ background: type === "positive" ? "rgba(0,229,160,0.04)" : "rgba(255,77,109,0.04)", border: `1px solid ${type === "positive" ? "rgba(0,229,160,0.2)" : "rgba(255,77,109,0.2)"}`, borderRadius: 12, padding: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: type === "positive" ? "#00e5a0" : "#ff4d6d", marginBottom: 10 }}>{label}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{item.title}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#4a5568" }}>{item.source} · {fmtDate(item.publishedAt)}</span>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: `${scoreColor(item.score)}18`, color: scoreColor(item.score), fontWeight: 700 }}>{item.score > 0 ? "+" : ""}{item.score?.toFixed(2)}</span>
                      </div>
                      {item.summary && <div style={{ fontSize: 12, color: "#4a5568", marginTop: 8, fontStyle: "italic" }}>{item.summary}</div>}
                      {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: type === "positive" ? "#00e5a0" : "#ff4d6d", marginTop: 8, display: "block" }}>Read article →</a>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── 5. ALL HEADLINES ── */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a5568", marginBottom: 16 }}>📋 Full Sentiment Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {enriched.map((h, i) => (
                  <div key={i} style={{ background: labelBg(h.label || "neutral"), border: `1px solid ${labelColor(h.label || "neutral")}22`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 4, minHeight: 36, borderRadius: 4, background: scoreColor(h.score || 0), flexShrink: 0, alignSelf: "stretch" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#d0d4de", marginBottom: 4 }}>
                        {h.url ? <a href={h.url} target="_blank" rel="noreferrer" style={{ color: "#d0d4de", textDecoration: "none" }}>{h.title}</a> : h.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#4a5568", marginBottom: h.summary ? 4 : 0 }}>{h.source} · {fmtDate(h.publishedAt)} {fmtTime(h.publishedAt)}</div>
                      {h.summary && <div style={{ fontSize: 11, color: "#4a5568", fontStyle: "italic" }}>{h.summary}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, minWidth: 80 }}>
                      {h.score !== undefined && <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(h.score), background: `${scoreColor(h.score)}18`, padding: "2px 8px", borderRadius: 20 }}>{h.score > 0 ? "+" : ""}{h.score?.toFixed(2)}</span>}
                      {h.confidence !== undefined && <span style={{ fontSize: 10, color: "#4a5568" }}>conf: {(h.confidence * 100).toFixed(0)}%</span>}
                      {h.impact !== undefined && <span style={{ fontSize: 10, color: "#4a5568" }}>impact: {(h.impact * 100).toFixed(0)}%</span>}
                      {h.emotion && <span style={{ fontSize: 10, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h.emotion}</span>}
                      {h.label && <span style={{ fontSize: 10, fontWeight: 600, background: labelBg(h.label), color: labelColor(h.label), padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" }}>{h.label}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 6. INTELLIGENCE REPORT (BOTTOM) ── */}
            {insights && (
              <div style={{ ...card, borderColor: "rgba(0,144,255,0.3)", background: "rgba(0,144,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0090ff" }}>💡 AI Intelligence Report</div>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: insights.confidence_level === "high" ? "rgba(0,229,160,0.15)" : insights.confidence_level === "medium" ? "rgba(255,209,102,0.15)" : "rgba(255,77,109,0.15)", color: insights.confidence_level === "high" ? "#00e5a0" : insights.confidence_level === "medium" ? "#ffd166" : "#ff4d6d", border: `1px solid ${insights.confidence_level === "high" ? "rgba(0,229,160,0.3)" : insights.confidence_level === "medium" ? "rgba(255,209,102,0.3)" : "rgba(255,77,109,0.3)"}` }}>
                    {insights.confidence_level?.toUpperCase()} CONFIDENCE
                  </span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: "#c8cedd", marginBottom: 20, padding: 16, background: "rgba(0,0,0,0.2)", borderRadius: 8, borderLeft: "3px solid #0090ff" }}>
                  {insights.executive_summary}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {insights.key_insight && (
                    <div style={{ padding: 14, background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.15)", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#00e5a0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>🔑 Key Insight</div>
                      <div style={{ fontSize: 12, color: "#a0aab8", lineHeight: 1.6 }}>{insights.key_insight}</div>
                    </div>
                  )}
                  {insights.momentum_interpretation && (
                    <div style={{ padding: 14, background: "rgba(0,144,255,0.05)", border: "1px solid rgba(0,144,255,0.15)", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#0090ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>📊 Momentum</div>
                      <div style={{ fontSize: 12, color: "#a0aab8", lineHeight: 1.6 }}>{insights.momentum_interpretation}</div>
                    </div>
                  )}
                  {insights.risk_flag && (
                    <div style={{ padding: 14, background: "rgba(255,77,109,0.05)", border: "1px solid rgba(255,77,109,0.15)", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#ff4d6d", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>⚠ Risk Flag</div>
                      <div style={{ fontSize: 12, color: "#a0aab8", lineHeight: 1.6 }}>{insights.risk_flag}</div>
                    </div>
                  )}
                  {insights.opportunity && (
                    <div style={{ padding: 14, background: "rgba(255,209,102,0.05)", border: "1px solid rgba(255,209,102,0.15)", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#ffd166", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>💰 Opportunity</div>
                      <div style={{ fontSize: 12, color: "#a0aab8", lineHeight: 1.6 }}>{insights.opportunity}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!metrics && !loading && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#4a5568" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              Pick a topic and click <strong style={{ color: "#00e5a0" }}>▶ Run Intelligence</strong><br />
              <span style={{ fontSize: 12 }}>Fetches live news → AI sentiment → Intelligence report</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
