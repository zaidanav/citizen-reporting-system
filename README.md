# Secure & Scalable Citizen Report System 🛡️
**Major Assignment IF4031 - Distributed Application Development**

This repository contains a Proof of Concept (PoC) implementation for a citizen reporting system based on **Microservices Architecture**. The system is designed to handle high concurrency, maintain reporter anonymity, and provide real-time monitoring to relevant agencies.

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+ (untuk frontend)
- PowerShell 5.1+

### Langkah 1: Build Backend Services (First Time Only)
```powershell
# Build Docker images untuk semua backend services
.\runner.ps1 build
```

### Langkah 2: Start Backend Services (Infrastructure + Backend)
```powershell
# Start semua services di Docker
.\runner.ps1 up
```

### Langkah 3: Start Frontend Applications
```powershell
# Install dependencies (first time only)
cd client/web-warga && npm install && cd ../..
cd client/dashboard-dinas && npm install && cd ../..

# Run frontend development servers
.\runner.ps1 frontend
```

**Access the system:**
- 🌐 **Web Warga (Citizen):** http://localhost:3000
- 👔 **Dashboard Dinas (Admin):** http://localhost:3001
- 🔐 **Auth Service:** http://localhost:8081
- 📝 **Report Service:** http://localhost:8082
- 🔔 **Notification Service:** http://localhost:8084
- 🐰 **RabbitMQ Console:** http://localhost:15672 (guest/guest)
- 🗄️ **MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)
- 📊 **Grafana Dashboard:** http://localhost:3002 (admin/admin)

**Stop services:**
```powershell
# Stop frontend (Ctrl+C di terminal frontend)
# Stop backend dan infrastructure
.\runner.ps1 down
```

📖 **Full documentation:** [RUNNER_GUIDE.md](./RUNNER_GUIDE.md)

---

## 🏗️ Structure & Development Zones

This project uses a **Monorepo** approach. Code is separated based on functional responsibilities (Zones) to facilitate team collaboration without configuration conflicts.

### 📂 Directory Map

```text
citizen-reporting-system/
├── infra/                  # [INFRASTRUCTURE ZONE]
│   ├── nginx/              # API Gateway & Routing Configuration
│   ├── prometheus/         # Monitoring & Alerting Configuration
│   ├── grafana/            # Metric Visualization Dashboard
│   └── db-init/            # Database initialization scripts (SQL seed)
│
├── services/               # [BACKEND MICROSERVICES ZONE]
│   ├── auth-service/       # Authentication Service & Token Management
│   ├── report-service/     # Main Service (Report CRUD)
│   ├── dispatcher-service/ # Routing Service & Agency Business Logic
│   └── notification-service/ # Real-time Service (WebSocket/SSE)
│
├── client/                 # [FRONTEND ZONE]
│   ├── web-warga/          # Web Application for Citizens
│   └── dashboard-dinas/    # Monitoring Dashboard for Officers
│
├── pkg/                    # [SHARED LIBRARIES]
│   ├── database/           # DB Connection Helpers (Postgres/Mongo)
│   ├── queue/              # Message Broker Connection Helpers (RabbitMQ)
│   └── response/           # JSON Response Standardization
│
├── docker-compose.yml      # Orchestration of all infrastructure containers
├── README.md               # Project Documentation
└── runner.ps1              # Task Runner (Project management script)
```

---

## 🛠️ Division of Responsibilities (Roles)

To ensure development runs in parallel and efficiently, each directory has a primary "owner":

### 1. The Orchestrator (Infrastructure Zone)

* **Domain:** `infra/`, `docker-compose.yml`, `runner.ps1`
* **Focus:** Preparing the "ground" where the application runs. Managing Nginx (Gateway), Message Broker (RabbitMQ), Database, and Monitoring (Prometheus/Grafana). Ensuring all containers can communicate with each other.

### 2. Backend Core Engineer (Services Zone)

* **Domain:** `services/` (Auth & Report), `pkg/`
* **Focus:** Developing core business logic. Handling data validation, security, data storage to Database, and sending messages to the Queue.

### 3. Frontend & Integration Engineer (Client Zone)

* **Domain:** `client/`, `services/` (Notification)
* **Focus:** Building user interfaces (UI/UX) for citizens and agencies. Integrating backend APIs into the frontend and handling real-time updates (Notifications).

---

## 🔌 Integration

Configurations to connect services and frontend applications.

### 1. Connection Strings
Note:
- Internal Host: When connecting from inside a Docker container (Go Code).
- External Host: When connecting from laptop (DBeaver, MongoDB Compass, etc.).

| Service | Internal Host (Code) | External Host (Tools) | Port (Int/Ext) | User / Pass | Connection URL Example (Internal) |
| --- | --- | --- | --- | --- | --- |
| **Postgres** | `lapcw-postgres` | `localhost` | **5432** / **5434** | `admin` / `password` | `postgres://admin:password@lapcw-postgres:5432/auth_db` |
| **MongoDB** | `lapcw-mongo` | `localhost` | **27017** / **27017** | `admin` / `password` | `mongodb://admin:password@lapcw-mongo:27017` |
| **RabbitMQ** | `lapcw-rabbitmq` | `localhost` | **5672** / **5672** | `guest` / `guest` | `amqp://guest:guest@lapcw-rabbitmq:5672/` |
| **MinIO** | `lapcw-minio` | `localhost` | **9000** / **9000** | `minioadmin`/`minioadmin` | *Use AWS S3 SDK* |

> **Tip:** Use the helper functions in `pkg/database` and `pkg/queue` to connect easily.

### 2. API Gateway Routes (Frontend)

Frontend applications (Web Warga & Dashboard Dinas) must **ONLY** access the backend via the API Gateway (Nginx).

* **Base URL:** `http://localhost` (Port 80)
* **Security:** Rate Limiting is active (10 requests/second per IP).

| Path Prefix | Target Service | Purpose |
| --- | --- | --- |
| `/api/auth/*` | Auth Service | Login, Register, Token Refresh |
| `/api/reports/*` | Report Service | Create, Read, Update Reports |
| `/storage/*` | MinIO Storage | Load uploaded images (Public Read) |

### 3. Event Contract (RabbitMQ)

When a new report is created, **Report Service** must publish a JSON message to `report_queue` with this exact structure:

```json
{
  "id": "UUID-V4",
  "title": "Judul Laporan",
  "category": "Sampah/Jalan/Keamanan",
  "is_anonymous": true,
  "reporter_id": "User-ID-123",
  "reporter_name": "Nama Pelapor",
  "description": "Deskripsi lengkap...",
  "created_at": "2025-12-28T10:00:00Z"
}

```

---

## 💻 Tech Stack

* **Language:** Go (Golang)
* **Gateway:** Nginx (Reverse Proxy & Rate Limiter)
* **Message Broker:** RabbitMQ
* **Database:** PostgreSQL (Relational), MongoDB (NoSQL)
* **Storage:** MinIO (S3 Compatible - Object Storage)
* **Monitoring:** Prometheus & Grafana

---

## 📝 Development Notes

* **Shared Packages:** If creating common functions (e.g., RabbitMQ connection), place them in the `pkg/` folder so they can be used by the *Report Service* and *Dispatcher Service* without code duplication.
* **Environment Variables:** Never upload `.env` files to Git. Use `.env.example` as a reference.