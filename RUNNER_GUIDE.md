# 🚀 Runner Script Guide

Panduan lengkap untuk menggunakan `runner.ps1` - PowerShell script untuk mengelola Citizen Reporting System.

## 📋 Prerequisites

### Software yang Dibutuhkan
- **Docker Desktop** - untuk menjalankan semua backend services dan infrastructure
- **Node.js 18+** - untuk frontend development servers
- **PowerShell 5.1+** - untuk menjalankan runner script

### Persiapan Awal

Frontend dependencies akan otomatis diinstall saat menjalankan `runner.ps1 frontend` untuk pertama kali.

Jika ingin install manual:
```powershell
# Web Warga
cd client/web-warga
npm install

# Dashboard Dinas
cd client/dashboard-dinas
npm install
```

---

## 🎯 Main Commands

### Quick Start (Recommended)

Untuk menjalankan sistem lengkap, gunakan **2 terminal**:

**Terminal 1 - Backend Services:**
```powershell
# First time only: Build Docker images
.\runner.ps1 build

# Start all backend services
.\runner.ps1 up
```

**Terminal 2 - Frontend Servers:**
```powershell
# Start frontend development servers
.\runner.ps1 frontend
```

**Access URLs:**
- 🌐 **Web Warga:** http://localhost:3000
- 👔 **Dashboard Dinas:** http://localhost:3001
- 🔐 **Auth API:** http://localhost:8081
- 📝 **Report API:** http://localhost:8082
- 🔔 **Notification API:** http://localhost:8084
- 🐰 **RabbitMQ Console:** http://localhost:15672 (guest/guest)
- 🗄️ **MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)
- 📊 **Grafana Dashboard:** http://localhost:3002 (admin/admin)

---

## 📚 Detailed Command Reference

### 1. Build Backend Services (First Time Only)

```powershell
.\runner.ps1 build
```

**Fungsi:**
- Build Docker images untuk semua backend services
- Stop container yang sedang berjalan
- Compile services: Auth, Report, Notification, Dispatcher

**Kapan digunakan:**
- ✅ Setup pertama kali
- ✅ Setelah update code backend
- ✅ Setelah git pull dari repository

---

### 2. Start Backend Services

```powershell
.\runner.ps1 up
```

**Yang akan dijalankan:**
- ✅ Infrastructure (Postgres, MongoDB, RabbitMQ, MinIO)
- ✅ Backend Services (Auth, Report, Notification, Dispatcher)
- ✅ Monitoring (Prometheus, Grafana)
- ✅ API Gateway (Nginx)

**Services berjalan di Docker containers:**
- `lapcw-auth-service` - Port 8081
- `lapcw-report-service` - Port 8082
- `lapcw-notification-service` - Port 8084
- `lapcw-dispatcher-service` - Background worker
- `lapcw-postgres` - Port 5434
- `lapcw-mongo` - Port 27017
- `lapcw-rabbitmq` - Port 5672, 15672
- `lapcw-minio` - Port 9000, 9001

---

### 3. Start Frontend Development Servers

```powershell
.\runner.ps1 frontend
```

**Yang akan dijalankan:**
- Web Warga (Port 3000) - Vite Dev Server
- Dashboard Dinas (Port 3001) - Vite Dev Server

**Fitur:**
- Auto-install npm dependencies jika belum ada
- Hot reload saat code berubah
- Development mode dengan source maps

**Note:** Backend harus sudah running (`runner.ps1 up`)

**Stop:** Tekan `Ctrl+C` di terminal

---

### 4. Stop All Backend Services

```powershell
.\runner.ps1 down
```

**Fungsi:**
- Stop semua Docker containers
- Cleanup resources
- Port akan di-release

---

### 5. Check Service Status

```powershell
.\runner.ps1 status
```

**Output:**
- List semua Docker containers
- Status (Up/Down)
- Port mapping
- Health check status

---

## 🔧 Utility Commands

### 1. Access Container Shell
Masuk ke shell container tertentu:

```powershell
# Database
.\runner.ps1 shell postgres
.\runner.ps1 shell mongo

# Message Queue
.\runner.ps1 shell rabbit

# Storage
.\runner.ps1 shell minio

# Monitoring
.\runner.ps1 shell grafana

# Backend Services
.\runner.ps1 shell auth
.\runner.ps1 shell report
.\runner.ps1 shell dispatcher
```

**Aliases yang tersedia:**
- `db` → postgres
- `mq` → rabbit
- `s3` → minio

### 2. Show Access Links
Tampilkan semua URL akses services:

```powershell
.\runner.ps1 link
```

### 3. Initialize MinIO Storage
Setup bucket untuk upload foto:

```powershell
.\runner.ps1 init-storage
```

Akan membuat:
- Bucket `laporan-warga`
- Set bucket sebagai PUBLIC
- Configure MinIO alias

---

## 📖 Common Workflows

### Workflow 1: Development Start (Recommended)
```powershell
# Terminal 1 - Backend
.\runner.ps1 build    # First time only
.\runner.ps1 up       # Start backend services

# Terminal 2 - Frontend
.\runner.ps1 frontend # Start frontend dev servers

# Akses aplikasi:
# - Web Warga: http://localhost:3000
# - Dashboard: http://localhost:3001
```

### Workflow 2: Stop All Services
```powershell
# Terminal dengan frontend: Ctrl+C
# Terminal untuk backend:
.\runner.ps1 down
```

### Workflow 3: Rebuild After Code Changes
```powershell
# Jika update backend code:
.\runner.ps1 down
.\runner.ps1 build
.\runner.ps1 up

# Frontend: Hot reload otomatis
```

### Workflow 4: Check Issues
```powershell
# Check service status
.\runner.ps1 status

# Check Docker logs
docker-compose logs -f [service-name]

# Access container shell
docker exec -it lapcw-postgres bash
```

---

## 🐛 Troubleshooting

### Issue: Port Already in Use
```powershell
# Check port usage
Get-NetTCPConnection -LocalPort 3000

# Kill process
Stop-Process -Id <PID> -Force

# Or stop all Docker services
.\runner.ps1 down
```

### Issue: Backend Services Not Starting
```powershell
# Check Docker container status
.\runner.ps1 status

# View container logs
docker-compose logs auth-service
docker-compose logs report-service

# Rebuild images
.\runner.ps1 down
.\runner.ps1 build
.\runner.ps1 up
```

### Issue: Frontend Not Starting
```powershell
# Reinstall dependencies
cd client/web-warga
rm -rf node_modules package-lock.json
npm install

cd ../dashboard-dinas
rm -rf node_modules package-lock.json
npm install

# Run frontend again
.\runner.ps1 frontend
```

### Issue: Docker Build Failed
```powershell
# Clean Docker cache
docker system prune -a

# Rebuild from scratch
.\runner.ps1 build

# If still fails, check Dockerfile syntax
```

---

## 📊 Service Ports Reference

### Frontend
| Service | Port | URL |
|---------|------|-----|
| Web Warga | 3000 | http://localhost:3000 |
| Dashboard Dinas | 3001 | http://localhost:3001 |

### Backend
| Service | Port | URL |
|---------|------|-----|
| Auth Service | 8081 | http://localhost:8081 |
| Report Service | 8082 | http://localhost:8082 |
| Notification Service | 8084 | http://localhost:8084 |
| Dispatcher Service | - | Background Worker |

### Infrastructure
| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| Postgres | 5432 | localhost:5432 | admin / password |
| MongoDB | 27017 | localhost:27017 | admin / password |
| RabbitMQ Management | 15672 | http://localhost:15672 | guest / guest |
| MinIO Console | 9001 | http://localhost:9001 | minioadmin / minioadmin |
| Grafana | 3000* | http://localhost:3000 | admin / admin |
| Prometheus | 9090 | http://localhost:9090 | - |

*Note: Grafana m4 | localhost:5434 | admin / password |
| MongoDB | 27017 | localhost:27017 | admin / password |
| RabbitMQ Management | 15672 | http://localhost:15672 | guest / guest |
| MinIO Console | 9001 | http://localhost:9001 | minioadmin / minioadmin |
| Grafana | 3002 | http://localhost:3002 | admin / admin |
| Prometheus | 9090 | http://localhost:9090 | - |
- Restart individual services jika perlu update code
- Check `.\runner.ps1 status` secara berkala

### 2. Resource Management
- Stop services saat tidak digunakan (`.\runner.ps1 stop`)
- Monitor Docker resource usage
- Clean up stopped containers: `docker-compose down -v`

### 3. Deb2 terminal: satu untuk backend (`up`), satu untuk frontend (`frontend`)
- Backend berjalan di Docker untuk consistency
- Frontend di development mode untuk hot reload
- Check status: `.\runner.ps1 status`

### 2. Resource Management
- Stop backend: `.\runner.ps1 down`
- Stop frontend: `Ctrl+C` di terminal
- Clean containers: `docker-compose down -v`
- Remove images: `docker system prune -a`

### 3. After Code Changes
- **Backend:** Rebuild required (`.\runner.ps1 build`)
- **Frontend:** Auto hot-reload
- **Database schema:** May need migration scripts

### 4. Git Workflow
```powershell
# Start development
.\runner.ps1 build  # If first time
.\runner.ps1 up     # Terminal 1
.\runner.ps1 frontend  # Terminal 2

# After coding
Ctrl+C              # Stop frontend
.\runner.ps1 down   # Stop backend
Run help command:
```powershell
.\runner.ps1 help
# atau
### Available Commands
```powershell
.\runner.ps1 help
# atau
.\runner.ps1
```

**Command Summary:**
- `build` - Build Docker images (first time)
- `up` - Start backend services
- `down` - Stop backend services
- `frontend` - Start frontend dev servers
- `status` - Check container status

### Documentation
- [README.md](README.md) - Project overview & quick start
- [docker-compose.yml](docker-compose.yml) - Infrastructure configuration
- This guide - Detailed runner script usage

### Common Issues
1. **Port conflict:** Check and kill conflicting processes
2. **Build failed:** Clean Docker cache and rebuild
3. **Container not starting:** Check Docker Desktop is running
4. **Frontend errors:** Reinstall node_modules
