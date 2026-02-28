# 🚀 PrioSync — Smart Task Prioritization System

> **"Stop managing time, start managing focus."**

PrioSync is an intelligent **Task Prioritization System** that revolutionizes daily productivity. Unlike traditional to-do lists, PrioSync uses an advanced **algorithmic scoring engine** to evaluate tasks based on urgency, importance, difficulty, and deadlines. It dynamically computes a **Priority Score** for every task, ensuring users always work on what truly matters.

Built with the **MERN stack** and powered by **Core Data Structures & Algorithms (DSA)**, PrioSync offers a seamless, high-performance experience for managing complex workflows.

---

## 🧐 Problem Statement

In today's fast-paced world, users are overwhelmed by long to-do lists without clear direction on what to tackle first. Traditional tools treat all tasks equally or rely on manual sorting, leading to:

- **Decision Fatigue** — Wasting time deciding what to do next.
- **Missed Deadlines** — Critical tasks get buried under trivial ones.
- **Inefficient Scheduling** — High-impact tasks are often delayed.

**PrioSync solves this** by automating decision-making. It intelligently ranks tasks using a weighted scoring algorithm, adapting in real-time to deadlines and user behavior.

---

## ✨ Key Features

- **🧠 Algorithmic Priority Engine** — Auto-calculates task priority scores (0–100) based on multiple weighted factors.
- **📊 Smart Dashboard** — Visual analytics for productivity trends, completion rates, and focus areas.
- **🔗 Task Dependency Management** — Handles complex workflows where tasks depend on others (DAG implementation).
- **⚡ Real-Time Updates** — Instant synchronization of task status and scores.
- **📅 Intelligent Scheduling** — Suggests the optimal order of execution using Greedy approaches.
- **🎨 Modern UI/UX** — A sleek, responsive interface with smooth animations powered by Framer Motion.
- **🔐 Secure Authentication** — JWT-based secure login and session management.
- **👤 User Profiles** — Personalized profile pages and account management.

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
| :--- | :--- |
| **React 19** | Dynamic, component-based user interface |
| **Vite 7** | Lightning-fast build tooling and HMR |
| **Tailwind CSS 4** | Utility-first responsive styling |
| **Zustand** | Lightweight global state management |
| **React Router v7** | Client-side routing and navigation |
| **Recharts** | Data visualization and analytics charts |
| **Framer Motion** | Smooth animations and transitions |
| **Axios** | HTTP client for API communication |
| **React Hook Form + Zod** | Form handling with schema-based validation |
| **React Hot Toast** | Elegant toast notifications |
| **Lucide React** | Modern icon library |

### Backend

| Technology | Purpose |
| :--- | :--- |
| **Node.js (≥20)** | Server-side JavaScript runtime |
| **Express.js 4** | RESTful API framework |
| **MongoDB** | NoSQL database for flexible data storage |
| **Mongoose 8** | ODM for schema validation and data modeling |
| **JWT** | Secure user authentication tokens |
| **bcrypt.js** | Password hashing |
| **Morgan** | HTTP request logging |
| **CORS** | Cross-origin resource sharing |

---

## 🏗️ System Architecture

PrioSync follows a **Client-Server Architecture**:

```
┌──────────────────────────────┐
│        Client (React)        │
│  Vite Dev Server / Vercel    │
│  Routes → Pages → Components │
│  Context / Hooks / Services  │
└──────────────┬───────────────┘
               │  REST API (Axios)
               ▼
┌──────────────────────────────┐
│      Server (Express.js)     │
│  Auth Middleware → Routes    │
│  Controllers → DSA Engine    │
│  Models (Mongoose)           │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     MongoDB (Atlas/Local)    │
│  Users Collection            │
│  Tasks Collection            │
└──────────────────────────────┘
```

1. **Client (Frontend):** React SPA that interacts with the user, displays the dashboard, and communicates with the backend via REST APIs.
2. **Server (Backend):** Node.js/Express server that handles business logic, priority calculations, and database operations.
3. **Database:** MongoDB stores user data, tasks, and historical performance metrics.
4. **DSA Engine:** A dedicated module within the backend that processes task attributes to generate priority scores.

---

## 🧩 DSA Concepts Used & Why

| Concept | Usage in PrioSync | Why It Was Chosen |
| :--- | :--- | :--- |
| **Priority Queue (Max Heap)** | Fetching the highest priority task instantly. | `extractMax` takes **O(1)** or **O(log N)**, ensuring immediate access to the most critical task. |
| **Graph (DAG)** | Handling Task Dependencies (Task A must be done before Task B). | A Directed Acyclic Graph perfectly models dependency chains, preventing circular logic. |
| **Greedy Algorithm** | Task Scheduling Optimization. | Makes locally optimal choices (e.g., "Shortest Processing Time First") to minimize lateness. |
| **Hashing (Hash Maps)** | Quick lookups for Task IDs and User Data. | Provides **O(1)** average time complexity for searching and retrieving task details. |

---

## 📂 Project Structure

```
PrioSync/
├── client/                         # Frontend (React + Vite)
│   ├── public/                     # Static assets
│   ├── src/
│   │   ├── api/                    # HTTP client setup (Axios)
│   │   │   └── httpClient.js
│   │   ├── assets/                 # Images and icons
│   │   ├── components/             # Reusable UI components
│   │   │   ├── CompletionChart.jsx
│   │   │   ├── DependencyGraph.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── LoadingSkeleton.jsx
│   │   │   ├── PriorityBadge.jsx
│   │   │   ├── ProductivityChart.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   └── TaskModal.jsx
│   │   ├── context/                # React Context providers
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/                  # Custom React hooks
│   │   │   └── useTasks.js
│   │   ├── pages/                  # Full page views
│   │   │   ├── AuthPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DependencyPage.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   └── TasksPage.jsx
│   │   ├── services/               # API service layer
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   └── taskService.js
│   │   ├── App.jsx                 # Root component with routing
│   │   ├── index.css               # Global styles
│   │   └── main.jsx                # Entry point
│   ├── index.html                  # HTML template
│   ├── vite.config.js              # Vite configuration
│   └── package.json
│
├── server/                         # Backend (Node.js + Express)
│   ├── config/
│   │   └── db.js                   # MongoDB connection with retry logic
│   ├── controllers/
│   │   ├── authController.js       # Register, Login, Profile handlers
│   │   └── taskController.js       # CRUD + priority operations
│   ├── dsa-engine/                 # Core DSA-based priority logic
│   │   ├── priorityEngine.js       # Weighted scoring algorithm
│   │   ├── priorityQueue.js        # Max Heap implementation
│   │   ├── dag.js                  # Directed Acyclic Graph for dependencies
│   │   └── scheduler.js            # Greedy task scheduler
│   ├── middleware/
│   │   ├── auth.js                 # JWT authentication middleware
│   │   └── errorHandler.js         # Centralized error handling
│   ├── models/
│   │   ├── Task.js                 # Task Mongoose schema
│   │   └── User.js                 # User Mongoose schema
│   ├── routes/
│   │   ├── authRoutes.js           # /api/auth endpoints
│   │   └── taskRoutes.js           # /api/tasks endpoints
│   ├── index.js                    # Server entry point
│   ├── .env.example                # Environment variable template
│   └── package.json
│
├── .gitignore
├── LICENSE                         # MIT License
└── README.md
```

---

## 🚀 Installation & Setup

Follow these steps to run the project locally.

### Prerequisites

- **Node.js** (v20 or higher)
- **MongoDB** (Local instance or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/singhharshitt/PrioSync.git
cd PrioSync
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory (see `.env.example` for reference):

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

Start the backend server:

```bash
npm run dev
```

### 3. Frontend Setup

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

### 4. Access the App

Open your browser and navigate to: **http://localhost:5173**

---

## 🌐 Deployment

PrioSync is configured for production deployment:

| Layer | Platform |
| :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) |
| **Backend** | [Render](https://render.com) |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) |

> Set environment variables on each platform — refer to `server/.env.example` for the full list.

---

## 🔮 Future Enhancements

- **AI Integration** — Use NLP to parse task details from natural language input.
- **Mobile App** — React Native version for iOS and Android.
- **Team Collaboration** — Shared workspaces for team task management.
- **Calendar Sync** — Integration with Google Calendar and Outlook.
- **Gamification** — Badges and streaks to boost user motivation.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙋‍♂️ Author

**Harshit Singh**

---
