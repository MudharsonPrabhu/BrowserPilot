# BrowserPilot 🤖

> The AI-native autonomous browser interaction platform. Intelligent web navigation, contextual understanding, and agentic workflow execution — all from a unified control layer.

![BrowserPilot](https://img.shields.io/badge/status-production--ready-brightgreen) ![TypeScript](https://img.shields.io/badge/typescript-5.x-blue) ![Next.js](https://img.shields.io/badge/next.js-16-black) ![Tests](https://img.shields.io/badge/tests-84%20passing-brightgreen) ![AI](https://img.shields.io/badge/ai-gpt--4o-purple) ![Playwright](https://img.shields.io/badge/automation-playwright-orange)

---

## ✨ What is BrowserPilot?

**BrowserPilot** is a production-grade, AI-powered autonomous browser operating layer. It enables AI agents and developers to interact with the web the way a human would — navigating, extracting, reasoning, and acting — at machine speed and scale.

Built on Playwright, OpenAI GPT-4o, and a real-time SSE architecture, BrowserPilot acts as a full-stack browser intelligence runtime: it launches persistent Chromium sessions, intercepts network traffic, performs multi-layer content extraction (including OCR), and uses AI to plan and execute complex multi-step workflows autonomously.

It is not a scraper. It is not a test runner. It is a **browser agent operating system**.

---

## ✨ Features

### 🌐 Autonomous Browser Control
- **Persistent Chromium profiles** — cookies, authentication, and sessions survive restarts
- **Full page interaction** — navigate, click, fill, scroll, select, key press — all programmatic
- **Tab management** — open, close, switch, and track tabs across sessions
- **Network interception** — silently captures JSON/GraphQL API responses for deep data extraction
- **Anti-detection** — bypasses common automation fingerprinting and bot-detection mechanisms

### 🧠 AI Planning Engine (OpenAI GPT-4o)
- **Content summarization** — extracts key insights, contextual topics, and structured semantic summaries
- **Context-aware decision engine** — analyzes page state and selects best actions with confidence scoring
- **Session summaries** — generates formatted markdown reports from extracted web content
- **Memory snapshots** — creates persistent, spaced-repetition knowledge cards from page data
- **Action planning** — AI determines next steps in multi-step autonomous workflows

### 🔍 Multi-Layer Extraction Pipeline
- **4-layer extraction** — DOM → Accessibility Tree → Network Capture → OCR (Tesseract.js)
- **Copy-protection detection** — falls back to accessibility/OCR for protected or obfuscated pages
- **Page classification** — automatically identifies content type, structure, and interaction model
- **Content fingerprinting** — deduplicates and caches extracted content for performance

### 🗂️ Workflow Orchestration
- **Interaction graph** — tracks topic coverage, page depth, and identifies unexplored areas
- **Workflow execution** — define multi-step agentic tasks and execute them autonomously
- **Session restore** — checkpoints and recovery from crashes or interruptions
- **Progress tracking** — persistent key-value memory for long-running agent sessions

### 🛡️ Resilience & Recovery
- **Circuit breaker** — prevents cascading failures across browser and AI services
- **Auto-recovery** — browser restart, DOM stabilization, and network retry with backoff
- **Login/auth detection** — alerts when session authentication expires or is challenged
- **Exponential backoff** — intelligent retry strategies for transient failures

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (recommended: 20+)
- **npm** 9+
- An **OpenAI API key** with GPT-4o access

### Installation

```bash
git clone <repo-url> browserpilot
cd browserpilot
npm install

# Install Playwright browsers
npx playwright install chromium

# Initialize the database
npx drizzle-kit push
```

### Configuration

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
LOG_LEVEL=info
BROWSER_HEADLESS=false
BROWSER_PROFILE=default
PORT=3000
```

### Running

```bash
# Development
npm run dev          # → http://localhost:3000

# Production
npm run build
npm start

# Tests
npm test             # Unit + integration tests (70 tests)
npm run test:e2e     # E2E API tests (14 tests, needs dev server running)
npm run test:all     # Run everything
```

---

## 🏗️ Architecture

```
browserpilot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Dashboard (main UI)
│   │   ├── layout.tsx          # Root layout + metadata
│   │   ├── globals.css         # Design system
│   │   └── api/                # 26 REST API routes
│   │       ├── session/        # start, restore, status
│   │       ├── browser/        # open, navigate, click, fill, scroll, screenshot
│   │       ├── extract/        # page extraction, context detection
│   │       ├── ai/             # plan, summarize, answer
│   │       ├── memory/         # memory snapshots, spaced recall
│   │       ├── interaction-graph/ # coverage + depth tracker
│   │       ├── summaries/      # generate session summaries
│   │       ├── progress/       # persistent agent state
│   │       ├── tasks/          # task queue management
│   │       └── stream/         # SSE real-time event stream
│   ├── components/dashboard/   # 6 UI components
│   ├── hooks/                  # use-sse, use-browser
│   └── lib/                    # Core services
│       ├── ai/                 # OpenAI client, tools, summarizer, memory engine
│       ├── browser/            # Playwright controller
│       ├── classifier/         # Page type classification
│       ├── db/                 # SQLite + Drizzle ORM (16 entities)
│       ├── errors/             # Error handler, circuit breaker, recovery
│       ├── events/             # Event bus (SSE backbone)
│       ├── extraction/         # DOM, A11y, network, OCR, pipeline
│       ├── session/            # Session manager, interaction graph
│       └── tasks/              # Agentic task queue
├── tests/
│   ├── unit/                   # 7 test files, 59 tests
│   ├── integration/            # 1 test file, 11 tests
│   └── e2e/                    # 1 test file, 14 tests
├── data/                       # SQLite DB + browser profiles (gitignored)
└── .env.local                  # Environment variables (gitignored)
```

### Data Flow

```
User / Agent Input → Dashboard UI → API Routes → Core Services → Browser/AI
                          ↑                                           ↓
                          └──── SSE Real-time Stream ←── Event Bus ←──┘
```

### Extraction Pipeline

```
Page Load
  ├── DOM Extraction (fast, reliable baseline)
  │     └── sufficient content? → accept
  ├── Accessibility Tree (semantic, structure-aware)
  │     └── sufficient content? → accept
  ├── Network Capture (intercepts raw API responses)
  │     └── structured data found? → supplement
  └── OCR Fallback (Tesseract.js, last resort)
        └── extract text directly from rendered screenshot
```

---

## 📡 API Reference

### Session
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session/start` | Launch a new persistent browser session |
| POST | `/api/session/restore` | Restore an existing session from checkpoint |
| GET | `/api/session/status` | Get current session state and browser status |

### Browser Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/browser/open` | Open a new browser tab |
| POST | `/api/browser/navigate` | Navigate to a URL |
| POST | `/api/browser/click` | Click a page element |
| POST | `/api/browser/fill` | Fill an input field |
| POST | `/api/browser/scroll` | Scroll the page |
| GET | `/api/browser/screenshot` | Capture current viewport screenshot |

### Extraction
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract/page` | Extract page content via multi-layer pipeline |
| POST | `/api/extract/context` | Extract structured context from current page |

### AI Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/summarize` | Summarize extracted web content |
| POST | `/api/ai/answer` | Context-aware decision engine (answer/choose) |
| POST | `/api/ai/plan` | Plan next autonomous action |
| POST | `/api/summaries/generate` | Generate session summary + memory snapshots |

### Workflow & Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/memory` | Memory snapshot CRUD + spaced recall scheduling |
| GET | `/api/interaction-graph` | Get interaction coverage graph |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stream` | SSE real-time event stream |
| GET/POST | `/api/tasks` | Agentic task queue management |
| POST/GET | `/api/progress/save` | Persistent key-value agent state |

---

## 🧪 Testing

```bash
# Unit + integration tests (no server needed)
npm test

# E2E tests (requires dev server running)
npm run test:e2e

# Watch mode
npm run test:watch
```

### Test Coverage

| Suite | Tests | Focus |
|-------|-------|-------|
| validators | 16 | Zod schema validation |
| task-queue | 8 | Queue lifecycle + pause/resume |
| page-classifier | 8 | URL pattern matching |
| circuit-breaker | 8 | State machine transitions |
| network-capture | 6 | Response classification |
| ai-tools | 8 | Tool schema definitions |
| logger | 5 | Structured JSON output |
| extraction (integration) | 11 | Fingerprinting + error classification |
| dashboard (e2e) | 14 | Full API endpoint validation |

---

## 🎨 UI Theming

BrowserPilot supports **dark** and **light** themes with automatic persistence:

- Click the ☀️/🌙 icon in the top bar to toggle
- Theme preference is stored in localStorage
- CSS custom properties drive the entire design system
- Glassmorphism effects, micro-animations, and gradient accents

---

## 📦 Database Schema

16 entities managed via **Drizzle ORM** with **SQLite** (WAL mode):

- `UserSession` — browser session lifecycle and profile binding
- `BrowserTab` — tab state and URL tracking
- `Workflow` / `WorkflowStep` / `WorkflowPage` — agentic workflow structure
- `PageSnapshot` / `ExtractedContent` — content extraction cache
- `ContextDetection` / `ContextOption` / `ContextDecision` — AI decision tracking
- `Task` / `TaskStep` — automation task orchestration
- `SessionSummary` / `MemorySnapshot` — AI-generated summaries and knowledge cards
- `MemoryItem` — persistent key-value agent memory store
- `ErrorEvent` — structured error audit log

---

## ⚙️ Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | required | OpenAI API key with GPT-4o access |
| `OPENAI_MODEL` | `gpt-4o` | Model to use for all AI inference |
| `LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `BROWSER_HEADLESS` | `false` | Run browser headless (true in production) |
| `BROWSER_PROFILE` | `default` | Persistent Chromium profile name |
| `PORT` | `3000` | HTTP server port |

---

## 🔐 Security Notes

- API keys are stored in `.env.local` and are **never committed to git**
- Browser profiles are stored in `./data/` (gitignored)
- The system is designed for **authorized, autonomous web interaction** on platforms you have permission to access
- Always respect robots.txt and platform Terms of Service when deploying agents

---

## 📄 License

MIT
