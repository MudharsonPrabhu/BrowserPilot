# BrowserPilot: AI-Powered Autonomous Browser Interaction Platform

## Overview
BrowserPilot is an advanced, AI-driven autonomous browser operating layer built for intelligent web navigation, agentic workflow execution, and contextual web understanding. Built on a modern Next.js stack and powered by Playwright and OpenAI's GPT-4o, the system autonomously navigates web platforms, extracts structured content, executes context-aware decisions, and generates persistent memory snapshots and session summaries in real-time.

## Core Features

### 🤖 Intelligent Browser Automation
- **Persistent Sessions**: Utilizes Playwright with persistent Chromium profiles, ensuring authentication cookies, logins, and session data survive across restarts.
- **Comprehensive Page Control**: Programmatic execution of human-like actions including navigation, clicking, form filling, scrolling, and keyboard events.
- **Anti-Detection**: Built-in configurations (e.g., bypassing `AutomationControlled` flags) to evade common bot-detection mechanisms.
- **Network Interception**: Silently captures JSON and GraphQL API responses directly from the network layer to extract clean structured data.

### 🧠 AI Planning & Decision Engine
- **Autonomous Summarization**: Extracts key topics and synthesizes comprehensive, structured markdown session summaries using OpenAI.
- **Context-Aware Decision Engine**: Analyzes complex page states and provides context-grounded action selection with confidence scoring.
- **Memory Snapshot Generation**: Automatically creates spaced-repetition knowledge snapshots (SM-2 scheduling) from extracted web content.
- **Workflow Planning**: AI dynamically determines the next best action in multi-step autonomous browsing sequences.

### 🔍 Robust Extraction Pipeline (4-Layer)
BrowserPilot employs a highly resilient, multi-tiered content extraction strategy to handle heavily obfuscated or protected pages:
1. **DOM Extraction**: Fast and reliable parsing for standard web pages.
2. **Accessibility Tree**: Parses semantic structures (using ARIA snapshots) for modern, complex web apps.
3. **Network Capture**: Intercepts backend API payloads, bypassing UI obfuscation entirely.
4. **OCR Fallback**: Integrates Tesseract.js to extract text directly from visual screenshots for heavily protected, copy-disabled pages.

### 📊 Interaction Graph & Analytics
- **Interactive Dashboard**: Real-time monitoring of browser agent tasks and automation status via Server-Sent Events (SSE).
- **Interaction Graph**: Visualizes page coverage, topic depth, and highlights unexplored areas for targeted agent traversal.
- **Progress Tracking**: Maintains granular records of workflow completion and agent state with intelligent recommendations.

### 🛡️ Enterprise-Grade Resilience
- **Circuit Breakers**: Prevents cascading system failures during network outages or major platform DOM changes.
- **Auto-Recovery**: Features automatic browser restarts, session checkpoints, and state restoration upon unexpected crashes.
- **Retry Mechanisms**: Implements exponential backoff strategies for transient failures and rate-limiting scenarios.

## Technical Stack & Architecture
- **Framework**: Next.js 16 (App Router), React 19.
- **Styling**: Tailwind CSS v4 with dynamic dark/light theming and glassmorphism design system.
- **Automation Engine**: Playwright (persistent Chromium profiles).
- **AI & Processing**: OpenAI Node SDK (GPT-4o), Tesseract.js (Optical Character Recognition).
- **Database**: SQLite (via `better-sqlite3`) managed by Drizzle ORM with WAL mode.
- **Testing**: Vitest for comprehensive Unit, Integration, and E2E testing.

## System Workflow
1. **Agent Initialization**: Actions are triggered via the Next.js dashboard UI or REST API.
2. **Task Queue**: The request is enqueued and dispatched to the internal Core Services orchestrator.
3. **Browser Execution**: The Playwright Controller (`browser-service.ts`) executes the necessary navigation, interaction, and extraction.
4. **AI Processing**: Extracted raw data is routed to OpenAI for summarization, structuring, or context-aware decision making.
5. **Real-time Feedback**: Results are persisted in the SQLite database and instantly streamed back to the frontend UI via an Event Bus and SSE.
