# Secure & Scalable Citizen Report System 🛡️
**Major Assignment IF4031 - Distributed Application Development**

This repository contains a Proof of Concept (PoC) implementation for a citizen reporting system based on **Microservices Architecture**. The system is designed to handle high concurrency, maintain reporter anonymity, and provide real-time monitoring to relevant agencies.

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

## 🚀 How to Run the Project (Quick Start)

Ensure the following are installed on your computer:

* **Docker Desktop** (Running)

### Using Task Runner (`runner.ps1`)

We provide a `runner.ps1` script to simplify container management without typing long Docker commands.

1. **Starting the System (Up)**
Start all infrastructure (DB, Queue, Services) in the background.
```powershell
.\runner.ps1 -Task up
```

2. **Checking Status (Check)**
Ensure all containers are running healthily.
```powershell
.\runner.ps1 -Task ps
```

3. **Viewing Logs (Debug)**
View activity logs from all services in real-time.
```powershell
.\runner.ps1 -Task logs
```

4. **Stopping the System (Down)**
Stop and clean up containers.
```powershell
.\runner.ps1 -Task down
```

---

## 💻 Tech Stack

* **Language:** Go (Golang)
* **Gateway:** Nginx
* **Message Broker:** RabbitMQ
* **Database:** PostgreSQL (Relational), MongoDB (NoSQL)
* **Storage:** MinIO (S3 Compatible - Object Storage)
* **Monitoring:** Prometheus & Grafana

---

## 📝 Development Notes

* **Shared Packages:** If creating common functions (e.g., RabbitMQ connection), place them in the `pkg/` folder so they can be used by the *Report Service* and *Dispatcher Service* without code duplication.
* **Environment Variables:** Never upload `.env` files to Git. Use `.env.example` as a reference.