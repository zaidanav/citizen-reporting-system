# 🚀 Runner Script Guide

A complete guide for using `runner.ps1`.

**NOTE:** Run commands from the **Project Root Folder**.

## 📋 Quick Start

To run the complete system, open **2 Terminals**:

**Terminal 1 - Backend & Infrastructure:**
```powershell
# Initial setup (Build images)
.\scripts\runner.ps1 build

# Run Backend
.\scripts\runner.ps1 up
```

**Terminal 2 - Frontend:**

```powershell
# Run Citizens Web & Department Dashboard
.\scripts\runner.ps1 frontend
```

## 🛠️ Full Command List

### 1. Service Management

| Command | Function |
| --- | --- |
| `.\scripts\runner.ps1 up` | Start all backend services (Docker) |
| `.\scripts\runner.ps1 down` | Stop and clean up all services |
| `.\scripts\runner.ps1 restart` | Stop and then restart services (Refresh) |
| `.\scripts\runner.ps1 build` | Rebuild Docker images (Use if there are Go code changes) |
| `.\scripts\runner.ps1 status` | Check container status (Health check) |
| `.\scripts\runner.ps1 logs` | View real-time logs for all services |

### 2. Utilities & Tools

| Command | Function |
| --- | --- |
| `.\scripts\runner.ps1 init-storage` | Automatically create MinIO buckets for image uploads |
| `.\scripts\runner.ps1 seed` | Seed the database with dummy citizen report data |
| `.\scripts\runner.ps1 help` | Show the help menu |

### 3. Shell Access (Shortcut)

Access the database/service terminal without typing long `docker exec` commands.

```powershell
# Access Postgres Database
.\scripts\runner.ps1 shell db

# Access MongoDB
.\scripts\runner.ps1 shell mongo

# Access RabbitMQ
.\scripts\runner.ps1 shell mq

# Access MinIO
.\scripts\runner.ps1 shell minio

# Access Grafana
.\scripts\runner.ps1 shell grafana
```

---

## 🌐 URL Access

After running `up` and `frontend`, access the system at:

### Frontend

* **Citizens Web:** http://localhost:3000 (or 5173 if there is a conflict)
* **Department Dashboard:** http://localhost:3001 (or 5174 if there is a conflict)

### Backend API

* **Gateway / Auth:** http://localhost:8081
* **Report API:** http://localhost:8082
* **Notification:** http://localhost:8084

### Monitoring & Tools

* **Grafana:** http://localhost:3000 (Login: admin/admin)
* **Prometheus:** http://localhost:9090
* **RabbitMQ:** http://localhost:15672 (Login: guest/guest)
* **MinIO:** http://localhost:9001 (Login: minioadmin/minioadmin)

---

## 🐛 General Troubleshooting

**Q: Error `docker-compose.yml not found`?**
A: Ensure you are running the command from the **Root Folder**, not from inside the `scripts/` folder. The script is designed to be smart, but it's safer to run from the root.

**Q: Frontend Port conflict (Error EADDRINUSE)?**
A: If port 3000 is in use (e.g., by Grafana), the frontend script will automatically look for another port (usually 5173). Check the frontend terminal output for the correct URL.

**Q: Database inaccessible?**
A: Try a full restart with:

```powershell
.\scripts\runner.ps1 restart
```