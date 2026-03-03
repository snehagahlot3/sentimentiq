<div align="center">

# 📡 SentimentIQ

### AI-Powered News Intelligence System

*Not just positive/negative — full intelligence reporting with momentum, volatility, market mood & AI-generated insights*

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-sentimentiq--two.vercel.app-00e5a0?style=for-the-badge)](https://sentimentiq-two.vercel.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-orange?style=for-the-badge)](https://groq.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🎯 What is SentimentIQ?

SentimentIQ is a real-time news intelligence dashboard that goes far beyond simple sentiment classification. It fetches live headlines on any topic, runs them through an AI model, computes financial-grade metrics, and generates a full analytical intelligence report — all in the browser.

This is not a tutorial project. It's a production-grade, multi-API system demonstrating:

- **Multi-step AI reasoning** — 3 sequential AI calls per analysis
- **Real-time data pipeline** — live news → structured sentiment → intelligence report
- **Financial analytics** — volatility, momentum, market mood computed from first principles
- **Full-stack architecture** — React frontend + Vercel serverless backend

---

## ✨ Features

### 🔴 Live News Intelligence
Fetches the latest 12 headlines from NewsAPI on any topic in real time. Topics include AI, stock market, bitcoin, climate change, healthcare, and more — or type anything custom.

### 🧠 AI Sentiment Scoring
Every headline is analyzed by LLaMA 3.3 70B and scored across four dimensions:
- **Score** — from -1.0 (very negative) to +1.0 (very positive)
- **Label** — Positive / Neutral / Negative
- **Confidence** — how certain the model is
- **Impact** — how significant this news is

### 📈 Sentiment Trend Chart
Interactive line chart showing raw sentiment scores alongside a 3-point moving average, revealing the overall trajectory of news sentiment across headlines.

### 🥧 Distribution Pie Chart
Visual breakdown of positive vs neutral vs negative headline count for quick at-a-glance assessment.

### 📊 Financial-Grade Metrics
Six computed metrics displayed as stat cards:
| Metric | Description |
|--------|-------------|
| Headlines | Total articles analyzed |
| Avg Score | Mean sentiment across all headlines |
| Volatility | Standard deviation of sentiment scores |
| Momentum | Linear regression slope — is sentiment trending up or down? |
| Market Mood | Bullish 📈 / Bearish 📉 / Stable ⚖️ |
| Positive Rate | Ratio of positive to total headlines |

### ⚡ Most Impactful Article
Ranks every article by `impact × confidence` score and highlights the single most significant headline, with an AI-generated one-sentence explanation of why it matters.

### 🟢🔴 Sentiment Highlights
Side-by-side display of the most positive and most negative headline, with scores, source, date, and a direct link to the full article.

### 💡 AI Intelligence Report
The crown feature — after all sentiment data is computed, a second AI call generates a full structured report:
- **Executive Summary** — 2-3 sentence analysis with specific numbers
- **Key Insight** — one sharp business-level observation
- **Risk Flag** — biggest concern in the current news landscape
- **Opportunity Signal** — positive trend worth watching
- **Momentum Interpretation** — what the trend direction actually means

---

## 🏗️ Architecture

```
User selects topic
        │
        ▼
┌─────────────────────────────────┐
│     Vercel Serverless Function  │
│     /api/news.js                │
│     → Fetches from NewsAPI      │
│     → Returns 12 articles       │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│     Groq API — Step 1           │
│     LLaMA 3.3 70B               │
│     → Scores each headline      │
│     → score, label, confidence, │
│       impact, emotion, summary  │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│     Local Computation           │
│     → Volatility (std dev)      │
│     → Momentum (linear reg.)    │
│     → Moving average            │
│     → Top article ranking       │
│     → Market mood               │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│     Groq API — Step 2           │
│     LLaMA 3.3 70B               │
│     → Generates intelligence    │
│       report from all data      │
└─────────────────────────────────┘
        │
        ▼
   Dashboard renders everything
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 | UI & state management |
| Charts | Recharts | Interactive visualizations |
| AI Model | Groq API (LLaMA 3.3 70B) | Sentiment analysis + insights |
| News Data | NewsAPI.org | Live headline fetching |
| Backend | Vercel Serverless Functions | NewsAPI proxy (avoids CORS) |
| Hosting | Vercel | Production deployment |
| Fonts | IBM Plex Mono | Monospace terminal aesthetic |

---

## ⚙️ Local Setup

### Prerequisites
- Node.js v18+
- A free [Groq API key](https://console.groq.com)
- A free [NewsAPI key](https://newsapi.org/register)

### Installation

```bash
# Clone the repository
git clone https://github.com/snehagahlot3/sentimentiq.git
cd sentimentiq

# Install dependencies
npm install

# Create environment file
touch .env
```

Add to your `.env` file:
```env
REACT_APP_GROQ_KEY=your_groq_api_key_here
REACT_APP_NEWS_KEY=your_newsapi_key_here
```

```bash
# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) — the app runs locally using a CORS proxy for NewsAPI.

---

## 🚀 Deployment

This project is deployed on Vercel. The `api/news.js` serverless function handles NewsAPI requests server-side, bypassing browser CORS restrictions.

To deploy your own instance:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Add your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## 📁 Project Structure

```
sentimentiq/
├── api/
│   └── news.js              # Vercel serverless function (NewsAPI proxy)
├── public/
├── src/
│   ├── App.js               # Main dashboard — all logic and UI
│   ├── App.css
│   └── index.js
├── .env                     # API keys (never committed)
├── .gitignore
├── package.json
└── README.md
```

---

## 🔑 API Keys

| Service | Link | Free Tier |
|---------|------|-----------|
| Groq | [console.groq.com](https://console.groq.com) | Free, no credit card |
| NewsAPI | [newsapi.org/register](https://newsapi.org/register) | 100 requests/day free |

---

## 🔒 Security

API keys are stored as environment variables and never committed to the repository. The `.env` file is included in `.gitignore` by default. On Vercel, keys are encrypted and injected at build time.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

MIT © 2026 — [snehagahlot3](https://github.com/snehagahlot3)

---

<div align="center">

Built with ❤️ using React, Groq AI, and NewsAPI

⭐ Star this repo if you found it useful!

</div>
