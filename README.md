# SentinelGate 🛡️

> **AI Without the Risk. Productivity Without the Breach.**

SentinelGate is a stateless middleware proxy that intercepts AI prompts, redacts sensitive data **locally** before it ever leaves your machine, and seamlessly re-injects real values back into the AI's response — so your workflow stays intact while your data stays protected.

---

## The Problem

Every time you paste a patient report, a customer record, or internal business data into an AI tool, that data hits an external server. Most teams either accept the risk or avoid AI altogether.

**SentinelGate eliminates the tradeoff.**

---

## How It Works

```
Your Prompt
    │
    ▼
┌─────────────────────────────┐
│     SentinelGate Proxy      │
│                             │
│  1. NER + Regex detection   │  ← runs fully offline (spaCy)
│  2. Replace with tokens     │  ← e.g. John Doe → [PERSON_1]
│  3. Store in local vault    │  ← AES-256 encrypted, session-scoped
└──────────────┬──────────────┘
               │  Clean prompt (no real data)
               ▼
         AI API (GPT / etc.)
               │
               ▼
┌─────────────────────────────┐
│     SentinelGate Proxy      │
│                             │
│  4. Receive AI response     │
│  5. Vault lookup            │  ← match tokens back to real values
│  6. Re-inject real data     │
└──────────────┬──────────────┘
               │
               ▼
    Final Response (with real names/values restored)
```

**Zero sensitive data transmitted. Full AI output quality.**

---

## Features

- **Offline NER detection** — spaCy (`en_core_web_sm`) runs locally, detects names, locations, orgs, dates, phone numbers, emails, and more
- **Regex fallback layer** — catches domain-specific patterns spaCy misses (Aadhaar, PAN, custom formats)
- **AES-256 encrypted vault** — session-scoped, never persists sensitive data beyond the session
- **Redaction preview** — see exactly what gets redacted before the prompt is sent
- **Audit log dashboard** — full history of what was redacted, when, and by which session
- **Stateless proxy design** — no sensitive data stored server-side, ever

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Next.js, Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB (vault + audit logs) |
| ML / NER | spaCy (offline, `en_core_web_sm`) + custom Regex engine |
| Security | AES-256 local encryption |

---

## Project Structure

```
sentinelgate/
├── backend/
│   ├── server.js           # Express proxy server
│   ├── ner/                # spaCy NER pipeline + regex engine
│   └── vault/              # MongoDB vault + AES-256 encryption
└── frontend/
    ├── pages/              # Next.js pages
    └── components/         # Prompt interface, redaction preview, audit log
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Python 3.9+
- MongoDB (local or Atlas)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/sentinelgate.git
cd sentinelgate

# Backend setup
cd backend
npm install
pip install spacy
python -m spacy download en_core_web_sm

# Frontend setup
cd ../frontend
npm install
```

### Running Locally

```bash
# Start backend proxy (from /backend)
npm run dev

# Start frontend (from /frontend)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use SentinelGate.

---

## Demo Scenario

A doctor needs to submit a patient report to an AI assistant for summarisation. The report contains the patient's name, Aadhaar number, diagnosis, and contact details.

With SentinelGate:
- All PII is detected and replaced with tokens locally
- The AI receives a clean, anonymised prompt
- The final summary is returned with all real values restored
- An audit log records what was redacted and when

**The AI never saw the patient's real data.**

---

## Built At

**HACKRUST 1.0** — by Team Logical Sleepers

| Name | Role |
|---|---|
| Yatharth Vats | Team Lead |
| Harsh Gautam | Backend + ML pipeline |
| Kartik Gautam | Frontend |

---
