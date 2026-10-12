# 🎓 Campus Placement Management System

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Architecture](https://img.shields.io/badge/Architecture-REST_API-6366F1?style=for-the-badge)](https://restfulapi.net/)

> **A full-stack web application for managing campus placements, job drives, and student applications with server-side eligibility verification.**

---

## 📌 Project Overview

The **Campus Placement Management System** is a unified, full-stack recruitment portal designed to streamline campus hiring drives. It bridges students, corporate recruiters, and placement officers by automating eligibility filtering, job applications, and recruitment lifecycle tracking.

The system features:
- **Server-Side Eligibility Engine:** Enforces minimum CGPA and qualifying branch constraints directly in the backend to eliminate ineligible submissions.
- **Recruitment Pipeline Stages:** Multi-stage workflow management (`Applied` → `Shortlisted` → `Interview` → `Selected` / `Rejected`).
- **Interactive Swagger / OpenAPI 3.0 Documentation:** Built-in interactive Swagger UI available at `/api-docs` to test endpoints directly.
- **Placement Analytics & Reporting:** Deep KPI insights including average package, highest package, department placement rates, and exportable CSV reports.
- **Automated Test Suite:** 9/9 automated unit and integration tests executing with Node.js test runner.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Client ["Frontend Layer (Vanilla HTML5 / CSS3 / ES6)"]
        A["Student Portal<br/>(Drives, Eligibility, Status Tracker)"]
        B["Recruiter Dashboard<br/>(Drive Authoring, Applicant Reviews)"]
        G["Swagger UI Documentation<br/>(/api-docs)"]
    end

    subgraph Server ["Backend API (Node.js & Express.js)"]
        C["REST Controller Router<br/>(Auth, Drives, Applications, Analytics)"]
        D["Server-Side Eligibility Guard<br/>(CGPA Cutoff & Branch Matching)"]
        H["Reporting Engine<br/>(CSV Exporter & OpenAPI Spec)"]
        E["Data Access Layer<br/>(db.js)"]
    end

    subgraph Storage ["Persistent Store"]
        F[("JSON Data Layer<br/>data/db.json")]
    end

    A -->|HTTP Requests| C
    B -->|HTTP Requests| C
    G -->|OpenAPI Spec| C
    C --> D
    C --> H
    D --> E
    C --> E
    E --> F
```

---

## ✨ Key Features

1. **Student Registration & Authentication:**
   - Account creation with degree branch and academic CGPA.
   - Session management and role-based view routing.

2. **Automated Eligibility Filtering:**
   - Filters job listings server-side so students only see drives they qualify for.
   - Rejects ineligible applications with `403 Forbidden` if submitted via direct API calls.

3. **Multi-Stage Recruitment Pipeline:**
   - Track candidates through each stage: `Applied` ➔ `Shortlisted` ➔ `Interview` ➔ `Selected` / `Rejected`.
   - Prevents duplicate applications with `409 Conflict` checks.

4. **Executive Placement Analytics & CSV Export:**
   - Real-time placement rates across academic departments (CSE, IT, ECE, MECH).
   - Automated salary metrics (highest package, average package).
   - One-click CSV export of placement drives (`/api/export/drives.csv`) and candidate applications (`/api/export/applications.csv`).

5. **Interactive Swagger / OpenAPI 3.0 Documentation:**
   - Fully documented REST API with embedded Swagger UI at `http://localhost:4000/api-docs`.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api-docs` | Interactive Swagger UI API documentation |
| `GET` | `/api/openapi.json` | OpenAPI 3.0 specification in JSON format |
| `GET` | `/api/analytics` | Executive placement KPI metrics, salary stats & branch rates |
| `GET` | `/api/stats` | High-level system statistics (drives, students, offers) |
| `GET` | `/api/export/drives.csv` | Download CSV report of all placement drives |
| `GET` | `/api/export/applications.csv` | Download CSV report of candidate applications |
| `POST` | `/api/auth/student/login` | Authenticate student credentials |
| `POST` | `/api/auth/student/register` | Register new student profile with CGPA & branch |
| `POST` | `/api/auth/company/login` | Authenticate corporate recruiter credentials |
| `GET` | `/api/drives` | Fetch all active campus placement drives |
| `POST` | `/api/drives` | Publish a new job drive (recruiter only) |
| `GET` | `/api/drives/eligible/:studentId` | Query drives that meet student's CGPA & branch criteria |
| `POST` | `/api/applications` | Submit application with eligibility and duplicate guards |
| `GET` | `/api/applications/student/:id` | Retrieve application history for a specific student |
| `GET` | `/api/applications/drive/:id` | List candidate applicants for a specific drive |
| `PATCH` | `/api/applications/:id/status` | Advance application stage (`shortlisted`, `interview`, `selected`, `rejected`) |

---

## 📂 Project Structure

```
campus-placement-management-system/
├── server.js            # Express.js REST application & route handlers
├── db.js                # JSON file data access layer (readDB / writeDB)
├── package.json         # NPM project dependencies and scripts
├── README.md            # Comprehensive documentation & architecture guide
├── data/
│   └── db.json          # Seed datastore (students, companies, drives, applications)
└── public/
    ├── index.html       # Single-page interface with role-based dashboard views
    ├── style.css        # Modern glassmorphic design system & responsive layout
    └── script.js        # API integration, DOM rendering & event handling
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
Ensure **Node.js (v18+)** and **npm** are installed.

### 2. Installation & Run
```bash
# Clone the repository
git clone https://github.com/dhruvsingh29-Driod/campus-placement-management-system.git
cd campus-placement-management-system

# Install dependencies
npm install

# Start the application server
npm start
```

Open your browser at **`http://localhost:4000`**.

---

## 🎯 Technical Interview Talking Points

### Q1: Why is eligibility checking enforced on the backend rather than only hiding cards in the UI?
> **Answer:** Client-side filtering is purely a presentation convenience. A malicious or inquisitive user could bypass the UI by sending a `POST /api/applications` request directly via `curl` or Postman. Validating CGPA and qualifying branches on the server ensures strict data integrity and guarantees ineligible students cannot submit applications regardless of client behavior.

### Q2: How does the data layer design enable seamless migration to a production database?
> **Answer:** All read/write persistence is isolated inside `db.js` (`readDB` and `writeDB`). Moving to MongoDB (Mongoose) or PostgreSQL (Prisma/TypeORM) only requires updating `db.js` without rewriting the core business logic inside Express route handlers.

### Q3: What security improvements would you implement in a production iteration?
> **Answer:** 
> 1. Hash passwords using `bcrypt` (currently stored plain for demo zero-setup simplicity).
> 2. Implement stateless `JWT` (JSON Web Token) authentication with HTTP-only cookies and role-based middleware (`verifyStudent`, `verifyCompany`).
> 3. Add input validation with libraries like `Joi` or `Zod` to sanitize requests.

---

## 📜 License
This project is licensed under the MIT License.
