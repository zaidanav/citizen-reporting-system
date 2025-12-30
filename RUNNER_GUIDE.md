# 🚀 Runner Script Guide

Panduan lengkap untuk menggunakan `runner.ps1` - PowerShell script untuk mengelola Citizen Reporting System.

## 📋 Prerequisites

### 1. Software yang Dibutuhkan
- **Docker Desktop** - untuk menjalankan infrastructure services
- **Go 1.21+** - untuk backend services
- **Node.js 18+** - untuk frontend applications
- **PowerShell 5.1+** - untuk menjalankan runner script

### 2. Persiapan Awal

#### Install Dependencies Frontend
```powershell
# Web Warga
cd client/web-warga
npm install

# Dashboard Dinas
cd client/dashboard-dinas
npm install
```

#### Verifikasi Go Modules
```powershell
# Di root project
go mod download
```

---

## 🎯 Main Commands

### 1. Start Full Development Environment
Jalankan SEMUA services (Infrastructure + Backend + Frontend) dalam satu command:

```powershell
.\runner.ps1 dev
```

**Yang akan dijalankan:**
- ✅ Docker Infrastructure (Postgres, MongoDB, RabbitMQ, MinIO, Grafana, Prometheus)
- ✅ Backend Services (Auth, Report, Notification, Dispatcher)
- ✅ Frontend Applications (Web Warga, Dashboard Dinas)

**Access URLs:**
- 🌐 Web Warga: http://localhost:3000
- 👔 Dashboard Dinas: http://localhost:3001
- 🔐 Auth API: http://localhost:8081
- 📝 Report API: http://localhost:8082
- 🔔 Notification API: http://localhost:8084

**Stop semua services:** Tekan `Ctrl+C`

---

### 2. Start Backend Only
Jalankan hanya Backend Services:

```powershell
.\runner.ps1 backend
```

**Yang akan dijalankan:**
- Auth Service (Port 8081)
- Report Service (Port 8082)
- Notification Service (Port 8084)
- Dispatcher Service (Background Worker)

**Note:** Infrastructure (Docker) harus sudah running!

---

### 3. Start Frontend Only
Jalankan hanya Frontend Applications:

```powershell
.\runner.ps1 frontend
```

**Yang akan dijalankan:**
- Web Warga (Port 3000)
- Dashboard Dinas (Port 3001)

**Note:** Backend services harus sudah running untuk fitur lengkap!

---

### 4. Stop All Services
Stop semua services yang berjalan:

```powershell
.\runner.ps1 stop
```

Akan menghentikan:
- Backend services (Go processes)
- Frontend applications (Node processes)
- Membersihkan port yang digunakan

---

### 5. Check Status
Lihat status semua services:

```powershell
.\runner.ps1 status
```

Output menampilkan:
- 🐳 Docker container status
- ⚙️ Backend services status (by port)
- 🌐 Frontend applications status (by port)

---

## 🐳 Docker Infrastructure Commands

### Start Infrastructure
```powershell
.\runner.ps1 up
```
Start semua Docker containers (DB, RabbitMQ, MinIO, dll)

### Stop Infrastructure
```powershell
.\runner.ps1 down
```
Stop semua Docker containers

### Restart Infrastructure
```powershell
.\runner.ps1 restart
```
Restart semua Docker containers

### Check Docker Status
```powershell
.\runner.ps1 ps
```
Lihat status Docker containers

### View Docker Logs
```powershell
.\runner.ps1 logs
```
Stream logs dari semua containers (real-time)

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

### Workflow 1: Full Development Start
```powershell
# 1. Start semuanya
.\runner.ps1 dev

# 2. Akses aplikasi
# - Web Warga: http://localhost:3000
# - Dashboard: http://localhost:3001

# 3. Stop saat selesai
# Tekan Ctrl+C
```

### Workflow 2: Restart Frontend Only
```powershell
# 1. Stop services yang berjalan
.\runner.ps1 stop

# 2. Start ulang frontend
.\runner.ps1 frontend
```

### Workflow 3: Debugging Backend
```powershell
# 1. Start infrastructure
.\runner.ps1 up

# 2. Start frontend
.\runner.ps1 frontend

# 3. Run backend manual (untuk debugging)
# Buka terminal baru untuk setiap service:
cd services/auth-service
go run main.go

cd services/report-service
go run main.go
```

### Workflow 4: Check Issues
```powershell
# 1. Check service status
.\runner.ps1 status

# 2. Check Docker logs
.\runner.ps1 logs

# 3. Access specific container
.\runner.ps1 shell postgres
```

---

## 🐛 Troubleshooting

### Issue: Port Already in Use
```powershell
# Solution 1: Stop all services
.\runner.ps1 stop

# Solution 2: Manual port cleanup
# Find process using port
Get-NetTCPConnection -LocalPort 3000

# Kill process
Stop-Process -Id <PID> -Force
```

### Issue: Backend Services Not Starting
```powershell
# 1. Check if infrastructure is running
.\runner.ps1 status

# 2. Start infrastructure if needed
.\runner.ps1 up

# 3. Check Go installation
go version

# 4. Check Go modules
cd services/auth-service
go mod download
```

### Issue: Frontend Not Building
```powershell
# 1. Check Node installation
node --version
npm --version

# 2. Reinstall dependencies
cd client/web-warga
rm -rf node_modules
npm install

cd client/dashboard-dinas
rm -rf node_modules
npm install
```

### Issue: Docker Services Not Starting
```powershell
# 1. Check Docker Desktop running
docker ps

# 2. Remove old containers
docker-compose down -v

# 3. Start fresh
.\runner.ps1 up

# 4. Initialize storage
.\runner.ps1 init-storage
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

*Note: Grafana menggunakan port 3000 di Docker, tapi di-map ke port lain jika konflik dengan Web Warga

---

## 🎓 Tips & Best Practices

### 1. Development Workflow
- Gunakan `.\runner.ps1 dev` untuk full environment
- Restart individual services jika perlu update code
- Check `.\runner.ps1 status` secara berkala

### 2. Resource Management
- Stop services saat tidak digunakan (`.\runner.ps1 stop`)
- Monitor Docker resource usage
- Clean up stopped containers: `docker-compose down -v`

### 3. Debugging
- Check logs dengan `.\runner.ps1 logs`
- Use `.\runner.ps1 shell` untuk inspect containers
- Monitor backend logs di terminal manual saat debugging

### 4. Git Workflow
```powershell
# Before coding
.\runner.ps1 dev

# After coding
.\runner.ps1 stop
git add .
git commit -m "feat: your changes"
git push
```

---

## 🆘 Need Help?

Run help command:
```powershell
.\runner.ps1 help
# atau
.\runner.ps1
```

Untuk bantuan lebih lanjut, lihat dokumentasi di:
- `README.md` - Project overview
- `docker-compose.yml` - Infrastructure config
- `ARCHITECTURE.md` - System architecture

---

**Happy Coding! 🚀**
