# Secure & Scalable Citizen Report System 🛡️
**Tugas Besar IF4031 - Arsitektur Aplikasi Terdistribusi**

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Go Version](https://img.shields.io/badge/go-1.21-cyan) ![Architecture](https://img.shields.io/badge/architecture-microservices-orange)

## 📖 Project Overview

This repository contains a Proof of Concept (PoC) implementation for a **Citizen Reporting System** built on a **Microservices Architecture**. The system is designed to allow citizens to report infrastructure or public issues securely and anonymously, while enabling government agencies to respond efficiently.

The system addresses key challenges in distributed applications: **High Concurrency**, **Data Privacy (Encryption)**, **Fault Tolerance**, and **Real-time Observability**.

### Key Features
* **Microservices Architecture:** Decoupled services (Auth, Report, Dispatcher, Notification) for independent scaling.
* **Event-Driven Design:** Uses **RabbitMQ** for asynchronous communication between services (e.g., dispatching reports to agencies).
* **End-to-End Privacy:** Critical data (reporter identity and description) is encrypted using **AES-256**.
* **Real-Time Updates:** Uses **Server-Sent Events (SSE)** to push status updates to the dashboard instantly.
* **Full Observability:** Integrated **Prometheus** & **Grafana** for monitoring metrics and **Distributed Tracing**.
* **Secure Gateway:** **Nginx** acts as the single entry point with Rate Limiting and SSL termination.

---

## 🏗️ Architecture & Tech Stack

The system is organized as a Monorepo using a clean separation of concerns:

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Language** | **Go (Golang)** | High-performance backend services. |
| **Gateway** | **Nginx** | Reverse Proxy, Rate Limiter, and SSL Termination. |
| **Message Broker** | **RabbitMQ** | Asynchronous event bus for decoupling services. |
| **Databases** | **PostgreSQL** & **MongoDB** | Polyglot persistence (Relational for Auth, NoSQL for Reports). |
| **Storage** | **MinIO** | S3-compatible object storage for evidence photos. |
| **Monitoring** | **Prometheus** & **Grafana** | Real-time metrics visualization and alerting. |
| **Frontend** | **React (Vite)** | Responsive web apps for Citizens and Admin Dashboard. |

---

## 📂 Directory Structure

```text
citizen-reporting-system/
├── scripts/                # Automation & Utility Scripts (Runner, Seeding)
├── infra/                  # Infrastructure as Code (Nginx, Prometheus, Grafana)
├── services/               # Backend Microservices
│   ├── auth-service/       # JWT Management & RBAC
│   ├── report-service/     # Report CRUD & Encryption
│   ├── dispatcher-service/ # Worker for Routing Logic & SLA
│   └── notification-service/ # Real-time SSE Push
├── client/                 # Frontend Applications
│   ├── web-warga/          # Public reporting portal
│   └── dashboard-dinas/    # Agency management dashboard
└── pkg/                    # Shared Go Libraries (Database, Queue, Logger)

```

---

## ⚡ Automation Scripts

To simplify development and deployment, we provide a set of PowerShell scripts located in the `scripts/` directory.

| Script | Description |
| --- | --- |
| **`runner.ps1`** | **The Main Controller.** Handles building, starting (up), stopping (down), and monitoring the entire stack. |
| **`create-admin.ps1`** | Automates the creation of Admin accounts (Operational, Strategic, Super Admin) directly into the database. |
| **`seed-sample-reports.ps1`** | Populates the database with dummy citizen reports for testing dashboards and analytics. |

---

## 🚀 Quick Start

This project requires **Docker Desktop**, **Node.js 18+**, and **PowerShell**.

> **⚠️ IMPORTANT:** All commands should be run from the **Root Project Directory**.

### 1. Build Backend (First Time Only)

Compile all Go services and build Docker images.

```powershell
.\scripts\runner.ps1 build

```

### 2. Start Infrastructure & Backend

Spins up Databases, RabbitMQ, MinIO, and all Microservices.

```powershell
.\scripts\runner.ps1 up

```

### 3. Start Frontend Applications

Starts the Citizen Web and Admin Dashboard in development mode.

```powershell
.\scripts\runner.ps1 frontend

```

### 4. Setup Data (Optional)

Initialize storage buckets and create admin users for testing.

```powershell
.\scripts\runner.ps1 init-storage
.\scripts\create-admin.ps1

```

### 🛑 Stop Services

```powershell
.\scripts\runner.ps1 down

```

### 🔗 Service Access Points

| Application | URL | Credentials (Default) |
| --- | --- | --- |
| **Web Warga** | http://localhost:3000 | Register via App |
| **Dashboard Dinas** | http://localhost:3001 | Use `create-admin.ps1` |
| **API Gateway** | http://localhost:8081 | - |
| **RabbitMQ Console** | http://localhost:15672 | `guest` / `guest` |
| **Grafana** | http://localhost:3002 | `admin` / `admin` |
| **MinIO Console** | http://localhost:9001 | `minioadmin` / `minioadmin` |

---

## 📚 Documentation & Guide

For a complete list of commands, troubleshooting steps, and advanced usage (like accessing database shells), please refer to the detailed guide:

👉 **[Read the RUNNER_GUIDE.md](./scripts/RUNNER_GUIDE.md)**
