# NetGuard

**AI-Powered Network Telemetry, Diagnostics & Incident Automation**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://netguard-three.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E)](https://supabase.com)

**[Live Demo](https://netguard-three.vercel.app)** · **[Repository](https://github.com/mohithjain0678-sudo/netguard)**

---

## Overview

NetGuard is a network monitoring and incident-response platform that watches live telemetry from connected probe agents, automatically detects anomalies, and uses AI to diagnose the likely root cause before a human ever opens a dashboard. Instead of raw metrics and manual triage, NetGuard turns network noise into a clear incident timeline with an explanation of *why* something broke and *what* to do next.

## Problem Statement

Traditional network monitoring tools are good at collecting metrics but poor at explaining them. Engineers are left staring at graphs of latency, packet loss, and jitter, manually correlating spikes across dashboards to guess at a root cause — usually after users have already noticed the outage. This reactive, manual process slows down incident response and buries the signal in noise.

## Solution

NetGuard closes the gap between "something looks wrong" and "here's what's wrong and why":

- Lightweight probe agents continuously collect network telemetry
- The telemetry pipeline ingests and stores this data in near real time
- An anomaly/incident detection layer flags deviations automatically
- An AI diagnosis engine analyzes the incident context and produces a plain-language root-cause explanation
- Everything is surfaced through a live dashboard with full incident lifecycle tracking

## Key Features

- 📡 Real-time network telemetry collection via a standalone probe agent
- 🚨 Automated incident detection from live metric streams
- 🤖 AI-generated root-cause diagnosis for detected incidents
- 📊 Incident lifecycle tracking — open, investigating, resolved
- 🗄️ Persistent storage and history powered by Supabase
- 🌐 Responsive web dashboard built on Next.js

## System Architecture

```
┌────────────────┐      telemetry       ┌──────────────────┐
│  Probe Agent    │ ───────────────────▶ │  Next.js API      │
│  (agent/)       │                      │  (app/)            │
└────────────────┘                      └────────┬──────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │  Supabase (DB)    │
                                          └────────┬──────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                                          ▼
                    ┌──────────────────┐                      ┌──────────────────┐
                    │ Incident Detection│ ───────────────────▶│ AI Diagnosis Engine│
                    └──────────────────┘                      └──────────────────┘
                              │                                          │
                              └────────────────┬─────────────────────────┘
                                                ▼
                                      ┌──────────────────┐
                                      │  Dashboard (UI)   │
                                      │  (components/)    │
                                      └──────────────────┘
```

## Telemetry Pipeline

The probe agent samples network conditions (latency, packet loss, throughput, connectivity checks) at a configured interval and pushes readings to the backend. Incoming telemetry is written to Supabase, which acts as the single source of truth for both live dashboard views and historical trend analysis.

## Incident Detection & Lifecycle

Incoming telemetry is continuously evaluated against expected thresholds and patterns. When a deviation is detected, NetGuard opens an incident record and tracks it through its lifecycle:

1. **Detected** — an anomaly crosses the threshold and an incident is created
2. **Diagnosing** — the AI engine analyzes the surrounding telemetry
3. **Diagnosed** — a root-cause explanation and severity are attached
4. **Resolved** — the incident closes once conditions return to normal

## AI Root-Cause Diagnosis

When an incident is opened, NetGuard passes the relevant telemetry window and incident context to an AI model, which returns a human-readable explanation of the likely cause (e.g., upstream packet loss, DNS resolution failure, latency spikes on a specific path) along with suggested next steps — turning a wall of metrics into an actionable summary.

## Probe Agent

The `agent/` directory contains a standalone process that runs independently of the web app. It continuously measures local network health and reports readings back to NetGuard, making it possible to monitor multiple networks or locations from a single dashboard.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database | Supabase |
| Styling | Tailwind CSS / PostCSS |
| Linting | ESLint |
| Agent | Node.js probe process |
| Hosting | Vercel |

## Project Structure

```
netguard/
├── agent/          # Standalone network probe agent
├── app/            # Next.js routes, pages & API endpoints
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks
├── lib/            # Shared utilities, Supabase & AI clients
├── public/         # Static assets
├── next.config.ts
├── tsconfig.json
└── package.json
```

## Supabase Database

NetGuard uses Supabase as its backing store for telemetry readings, incidents, and diagnosis records. Set up a Supabase project and configure the connection details as environment variables (see below) before running the app.

## Local Setup

### 1. Clone repository

```bash
git clone https://github.com/mohithjain0678-sudo/netguard.git
cd netguard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root with your Supabase and AI provider credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
AI_API_KEY=your_ai_provider_api_key
```

### 4. Start Next.js application

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### 5. Start probe agent

```bash
cd agent
npm install
npm start
```

## Demo Incident Simulation

NetGuard includes a simulation mode to generate synthetic network incidents, useful for testing the detection and AI diagnosis pipeline without needing a live degraded network.

## Live Demo

🔗 **[netguard-three.vercel.app](https://netguard-three.vercel.app)**

## GitHub Repository

🔗 **[github.com/mohithjain0678-sudo/netguard](https://github.com/mohithjain0678-sudo/netguard)**

## Screenshots

*Add dashboard, incident timeline, and diagnosis screenshots here.*

## Team

Built by [Mohith Jain](https://github.com/mohithjain0678-sudo).

## Future Enhancements

- [ ] Multi-region probe agent fleet management
- [ ] Alerting via email / Slack / webhook integrations
- [ ] Historical trend analytics and reporting
- [ ] Role-based access for team dashboards
- [ ] Configurable anomaly-detection thresholds per network

---

<p align="center">Made with ❤️ by Mohith Jain</p>
