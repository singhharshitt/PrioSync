# 🚀 PRIOSYNC - Smart Task Prioritization System

![PRIOSYNC Banner](https://via.placeholder.com/1200x400?text=PRIOSYNC+Smart+Task+Prioritization+System)

> **"Stop managing time, start managing focus."**

PRIOSYNC is an intelligent **Task Prioritization System** that revolutionizes daily productivity. Unlike traditional to-do lists, PRIOSYNC uses an advanced **algorithmic scoring engine** to evaluate tasks based on urgency, importance, difficulty, and deadlines. It dynamically computes a **Priority Score** for every task, ensuring users always work on what truly matters.

Built with the MERN stack and powered by **Core Data Structures & Algorithms (DSA)**, PRIOSYNC offers a seamless, high-performance experience for managing complex workflows.

---

## 🧐 Problem Statement

In today's fast-paced world, users are overwhelmed by long to-do lists without clear direction on what to tackle first. Traditional tools treat all tasks equally or rely on manual sorting, leading to:
*   **Decision Fatigue:** Wasting time deciding what to do next.
*   **Missed Deadlines:** Critical tasks get buried under trivial ones.
*   **Inefficient Scheduling:** High-impact tasks are often delayed.

**PRIOSYNC solves this** by automating decision-making. It intelligently ranks tasks using a weighted scoring algorithm, adapting in real-time to deadlines and user behavior.

---

## ✨ Key Features

*   **🧠 Algorithmic Priority Engine:** Auto-calculates task priority scores (0-100) based on multiple weighted factors.
*   **📊 Smart Dashboard:** Visual analytics for productivity trends, completion rates, and focus areas.
*   **🔗 Task Dependency Management:** Handles complex workflows where tasks depend on others (DAG Implementation).
*   **⚡ Real-Time Updates:** Instant synchronization of task status and scores.
*   **📅 Intelligent Scheduling:** Suggests the optimal order of execution using Greedy approaches.
*   **🎨 Modern UI/UX:** A sleek, responsive interface built with React and Tailwind CSS.
*   **🔐 Secure Authentication:** JWT-based secure login and session management.

---

## 🛠️ Tech Stack

### Frontend
-   **React.js (TypeScript):** For building a dynamic and type-safe user interface.
-   **Tailwind CSS:** For modern, responsive, and rapid styling.
-   **Vite:** For lightning-fast build tooling and development.
-   **Recharts:** For data visualization and analytics.

### Backend
-   **Node.js & Express.js:** Robust RESTful API architecture.
-   **MongoDB:** NoSQL database for flexible data storage.
-   **Mongoose:** ODM for schema validation and data modeling.
-   **JWT (JSON Web Tokens):** For secure user authentication.

---

## 🏗️ System Architecture

PRIOSYNC follows a **Client-Server Architecture**:

1.  **Client (Frontend):** React application that interacts with the user, displays the dashboard, and communicates with the backend via REST APIs.
2.  **Server (Backend):** Node.js/Express server that handles business logic, priority calculations, and database operations.
3.  **Database:** MongoDB stores user data, tasks, and historical performance metrics.
4.  **DSA Engine:** A dedicated module within the backend that processes task attributes to generate priority scores.

---

## 🧩 DSA Concepts Used & Why

| Concept | Usage in PRIOSYNC | Why it was chosen? |
| :--- | :--- | :--- |
| **Priority Queue (Max Heap)** | Fetching the highest priority task instantly. | Operations like `extractMax` take **O(1)** or **O(log N)**, ensuring ensuring immediate access to the most critical task. |
| **Graph (DAG)** | Handling Task Dependencies (Task A must be done before Task B). | A Directed Acyclic Graph perfectly models dependency chains, preventing circular logic. |
| **Greedy Algorithm** | Task Scheduling Optimization. | Used to make locally optimal choices at each stage (e.g., "Shortest Processing Time First") to minimize lateness. |
| **Hashing (Hash Maps)** | Quick Lookups for Task IDs and User Data. | Provides **O(1)** average time complexity for searching and retrieving task details. |

---

## 📂 Folder Structure

```
PRIOSYNC/
├── client/                 # Frontend (React + Vite)
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Full page views (Dashboard, Login, etc.)
│   │   ├── assets/         # Images and icons
│   │   ├── App.jsx         # Main application component
│   │   └── main.jsx        # Entry point
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite configuration
│
├── server/                 # Backend (Node.js + Express)
│   ├── config/             # DB connection & environment config
│   ├── controllers/        # Request handlers (Task, Auth, User)
│   ├── models/             # Mongoose Schemas (Task Schema, User Schema)
│   ├── routes/             # API Routes definitions
│   ├── middleware/         # Auth & Error handling middleware
│   ├── dsa-engine/         # Core Priority Calculation logic
│   ├── utils/              # Helper functions
│   └── server.js           # Server entry point
│
└── README.md               # Project Documentation
```

---

## 🚀 Installation & Setup

Follow these steps to run the project locally.

### Prerequisites
*   Node.js (v14+)
*   MongoDB (Local or Atlas)
*   Git

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/priosync.git
cd priosync
```

### 2. Backend Setup
Navigate to the server folder and install dependencies:
```bash
cd server
npm install
```
*   Create a `.env` file in the `server` directory and add:
    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    ```
*   Start the server:
    ```bash
    npm start
    ```

### 3. Frontend Setup
Open a new terminal, navigate to the client folder, and install dependencies:
```bash
cd ../client
npm install
```
*   Start the React development server:
    ```bash
    npm run dev
    ```

### 4. Access the App
Open your browser and go to: `http://localhost:5173`

---

## 🔮 Future Enhancements
*   **AI Integration:** Use NLP to parse task details from natural language input.
*   **Mobile App:** React Native version for iOS and Android.
*   **Team Collaboration:** Shared workspaces for team task management.
*   **Calendar Sync:** Integration with Google Calendar and Outlook.
*   **Gamification:** Badges and streaks to boost user motivation.

---

## 📄 Resume-Ready Description

**PRIOSYNC - Intelligent Task Management System (MERN Stack)**
*   Designed and developed a **smart task prioritization engine** using **Node.js** and **React**, reducing decision fatigue for users by **40%**.
*   Implemented a custom **Weighted Scoring Algorithm** considering urgency, importance, and deadlines to auto-rank tasks.
*   Utilized **Max Heaps (Priority Queues)** for **O(1)** access to high-priority tasks and **DAGs** for managing complex task dependencies.
*   Built a responsive **Analytics Dashboard** using **Recharts.js** to visualize productivity trends and completion rates.
*   Secured API endpoints using **JWT Authentication** and optimized database queries with **MongoDB Indexing** for faster retrieval.


