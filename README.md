# ApplicationTracker 🎯

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> A production-ready, multi-tenant job application tracking system with a **Manifest V3 Chrome Extension**, a **React + TypeScript analytics dashboard**, and a modular **Node.js/Express MVC backend** featuring real-time WebSocket synchronization.

---

## 🌟 Key Capabilities

### 1. 🧩 Chrome Extension (Manifest V3)
* **One-Click & Auto-Detection**: Dynamically scrapes application metadata directly from job portals including **LinkedIn**, **Internshala**, and **Unstop**.
* **Smart Heuristics**: Multi-tier DOM selector matching with an aggressive fallback parser that extracts company name, position, salary, location, job description, and apply URL.
* **Non-Intrusive Workflow**: Injects listeners onto application CTA buttons using `MutationObservers` for Single-Page Applications (SPAs).
* **Dual-Mode Sync**: Connects securely via persistent API keys (`x-api-key`) with automatic offline storage fallback (`chrome.storage.local`) and background retry queue.

### 2. 📊 Full-Stack Analytics Dashboard
* **KPI Metrics & Funnel Cards**: Real-time overview of active applications, upcoming interviews, offers, and rejections.
* **Interactive Timeline Visualizations**: Track job submission pace over time with Recharts analytics.
* **Interview Scheduler**: Dedicated interview management with date, time, round type, and status tracking.
* **Live WebSocket Synchronization**: Live updates push directly to your open browser tab when a job is clipped from Chrome without refreshing.

### 3. 🛡️ Modular MVC Architecture & Security
* **Layered Design**: Clean separation of concerns across `config/`, `controllers/`, `models/`, `routes/`, `middleware/`, and `services/`.
* **Dual-Tier Authentication**:
  * **Web Users**: Signed JWT Bearer tokens with salted `bcryptjs` password hashing.
  * **Extension Clients**: Cryptographically secure API keys (`jt_...`) with one-click regeneration and zero cross-tenant data leakage.
* **User-Scoped Multi-Tenancy**: Every MongoDB query is strictly partitioned and indexed by authenticated `userId`.
* **Duplicate Prevention**: Multi-field regex deduplication stops duplicate job entries.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────┐            ┌──────────────────────────────────┐
│     Chrome Extension (MV3)      │            │     Web Dashboard (React/TS)     │
│  - DOM Content Script Scraper   │            │  - KPI Analytics & Funnel Charts │
│  - Settings (API Key & Host)    │            │  - Interview Schedule Tracker    │
│  - Background Service Worker    │            │  - Dual Auth Modals & API Keys   │
└────────────────┬────────────────┘            └────────────────┬─────────────────┘
                 │ x-api-key                                    │ Bearer <JWT>
                 ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Node.js / Express MVC Backend                            │
│  ├── /api/auth          → Registration, Login, Profile (/me), API Key Rotation  │
│  ├── /api/applications  → CRUD & Synchronizations (User-Scoped)                 │
│  ├── Middleware         → Dual JWT & API Key Authentication Verification        │
│  └── WebSocket Service  → Targeted User Socket Notifications                    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MongoDB Database                                   │
│  ├── users collection        → Hashed credentials, unique API keys, timestamps  │
│  └── applications collection → Compound indexed: (userId, company, position)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Monorepo Structure

```
ApplicationTracker/
├── backend/                    # Express.js REST API & WebSocket Server
│   ├── config/
│   │   └── db.js               # MongoDB connection pooling & index initialization
│   ├── controllers/
│   │   ├── authController.js   # User registration, login, and key generation
│   │   └── applicationController.js # CRUD endpoints scoped to userId
│   ├── middleware/
│   │   └── auth.js             # Dual Auth Middleware (Bearer JWT & x-api-key)
│   ├── models/
│   │   ├── User.js             # User schema, bcrypt hashing, API keys
│   │   └── Application.js      # Data sanitization, deduplication, indexes
│   ├── routes/
│   │   ├── authRoutes.js       # /api/auth routes
│   │   └── applicationRoutes.js # /api/applications routes
│   ├── services/
│   │   └── websocketService.js # User-targeted WebSocket notifications
│   ├── Dockerfile              # Node.js 18 production container
│   └── server.js               # Clean application bootstrap
│
├── extension/                  # Google Chrome Extension (Manifest V3)
│   ├── manifest.json           # Permissions, host patterns, service workers
│   ├── content.js              # DOM scraper with MutationObserver & CTA clicks
│   ├── popup.html              # Interface with ⚙️ Settings modal
│   ├── popup.js                # API key management & submission handler
│   └── background.js           # Background service worker & offline sync queue
│
├── frontend/                   # React 18 + Vite Web Dashboard
│   ├── public/                 # Static assets & PWA files
│   ├── src/
│   │   ├── components/         # Dashboard, Applications, Interviews, AuthModal
│   │   │   └── ui/             # Radix UI primitives (button, dialog, card, etc.)
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Global authentication provider & state
│   │   ├── hooks/              # useToast notification hooks
│   │   ├── lib/                # Tailwind utilities
│   │   ├── App.tsx             # Root routing & layout provider
│   │   └── main.tsx            # Application entry point
│   ├── Dockerfile              # Multi-stage build (Vite + Nginx Alpine)
│   ├── nginx.conf              # Nginx reverse proxy configuration
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── docker-compose.yml          # Multi-container orchestration (Mongo, API, Client)
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Guide

### Option 1: 🐳 Run with Docker Compose (1 Command)

Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running, then execute:

```bash
docker-compose up --build
```

Services will be accessible at:
* **Frontend Web Dashboard**: [http://localhost:80](http://localhost:80)
* **Backend API Server**: [http://localhost:3001](http://localhost:3001)
* **MongoDB Database**: `localhost:27017`

---

### Option 2: 💻 Local Development Setup

#### 1. Backend API Server
```bash
cd backend
npm install
npm run dev
```
*API runs at `http://localhost:3001` with auto-reloading via Nodemon.*

#### 2. Frontend React Dashboard
```bash
cd frontend
npm install
npm run dev
```
*Dashboard runs at `http://localhost:8080` (or the port specified in terminal).*

#### 3. Install the Chrome Extension
1. Open Google Chrome and visit `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `extension/` directory from this repository.
4. Click the **JobTracker Assistant** icon in your toolbar.
5. Click **⚙️ Settings**, enter your API Key from the web dashboard, and set your backend URL (e.g. `http://localhost:3001`).

---

## 🔌 API Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | None | Register a new user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | None | Authenticate with credentials and receive JWT |
| `GET` | `/api/auth/me` | Bearer | Retrieve current user profile and active API key |
| `POST` | `/api/auth/api-key` | Bearer | Regenerate extension API key |

### Applications (`/api/applications`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/applications` | Bearer / API Key | Fetch all applications for authenticated user |
| `POST` | `/api/applications` | Bearer / API Key | Create new application (sanitized & deduplicated) |
| `PUT` | `/api/applications/:id`| Bearer / API Key | Update application status, notes, or details |
| `DELETE`| `/api/applications/:id`| Bearer / API Key | Delete application record |
| `POST` | `/api/applications/sync`| Bearer / API Key | Batch synchronize offline applications |

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```ini
PORT=3001
MONGODB_URI=mongodb://localhost:27017/jobtracker
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```ini
VITE_BACKEND_URL=http://localhost:3001
```

---

## 🔒 Security Practices

- **Zero Clear-Text Credentials**: Passwords hashed with `bcryptjs` using automatic salt generation.
- **Strict Tenant Separation**: All application records contain a mandatory `userId` reference; cross-tenant queries are blocked at the database driver level.
- **Environment Isolation**: Database URIs and JWT secrets are injected via environment variables.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
