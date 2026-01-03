param(
    [Parameter(Position=0)]
    [string]$Task = "help",

    [Parameter(Position=1)]
    [string]$Target = ""
)

$script:ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Running Task: $Task" -ForegroundColor Cyan

switch ($Task) {
    "build" {
        Write-Host "Building Docker images for backend services..." -ForegroundColor Cyan
        
        Write-Host "`nStopping existing containers..." -ForegroundColor Yellow
        docker-compose down
        
        Write-Host "`nBuilding Docker images..." -ForegroundColor Yellow
        docker-compose build auth-service report-service notification-service dispatcher-service
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nDocker images built successfully!" -ForegroundColor Green
            Write-Host "Next: Start services with .\runner.ps1 up" -ForegroundColor Cyan
        } else {
            Write-Host "`nDocker build failed!" -ForegroundColor Red
        }
    }
    
    "up" {
        Write-Host "Starting all services with Docker..." -ForegroundColor Cyan
        docker-compose up -d
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nAll services started!" -ForegroundColor Green
            Write-Host "`nService URLs:" -ForegroundColor Yellow
            Write-Host "  Auth Service: http://localhost:8081" -ForegroundColor White
            Write-Host "  Report Service: http://localhost:8082" -ForegroundColor White
            Write-Host "  Notification Service: http://localhost:8084" -ForegroundColor White
            Write-Host "  RabbitMQ Console: http://localhost:15672 (guest/guest)" -ForegroundColor White
            Write-Host "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)" -ForegroundColor White
            Write-Host "  Grafana: http://localhost:3002 (admin/admin)" -ForegroundColor White
        }
    }
    
    "down" {
        Write-Host "Stopping all Docker services..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "All services stopped." -ForegroundColor Green
    }

    "restart" {
        Write-Host "🔄 Restarting system..." -ForegroundColor Yellow
        docker-compose down
        docker-compose up -d --remove-orphans
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ System Restarted!" -ForegroundColor Green
            Write-Host "`nService URLs:" -ForegroundColor Yellow
            Write-Host "  Auth Service: http://localhost:8081" -ForegroundColor White
            Write-Host "  Report Service: http://localhost:8082" -ForegroundColor White
            Write-Host "  Grafana: http://localhost:3002" -ForegroundColor White
            Write-Host "  RabbitMQ: http://localhost:15672" -ForegroundColor White
        }
    }

    "logs" {
        Write-Host "📋 Tailing logs (Press Ctrl+C to exit)..." -ForegroundColor Cyan
        docker-compose logs -f
    }

    "shell" {
        if ([string]::IsNullOrEmpty($Target)) {
            Write-Host "❌ Specify a target! Usage: .\runner.ps1 shell [mongo|db|mq|minio|grafana]" -ForegroundColor Red
            return
        }

        switch ($Target) {
            "mongo"   { docker exec -it lapcw-mongo mongosh -u admin -p password }
            "db"      { docker exec -it lapcw-postgres psql -U admin -d auth_db }
            "postgres"{ docker exec -it lapcw-postgres psql -U admin -d auth_db }
            "mq"      { docker exec -it lapcw-rabbitmq sh }
            "rabbit"  { docker exec -it lapcw-rabbitmq sh }
            "minio"   { docker exec -it lapcw-minio sh }
            "grafana" { docker exec -it lapcw-grafana bash }
            Default   { Write-Host "❌ Unknown target '$Target'. Available: mongo, db, mq, minio, grafana" -ForegroundColor Red }
        }
    }

    "init-storage" {
        Write-Host "🗄️  Initializing MinIO Storage..." -ForegroundColor Cyan
        Start-Sleep -Seconds 2
        # Set Alias & Buat Bucket
        docker exec lapcw-minio mc alias set myminio http://localhost:9000 minioadmin minioadmin
        docker exec lapcw-minio mc mb myminio/citizen-reports --ignore-existing
        docker exec lapcw-minio mc anonymous set public myminio/citizen-reports
        Write-Host "✅ Storage bucket 'citizen-reports' is ready and public!" -ForegroundColor Green
    }
    
    "seed" {
        Write-Host "🌱 Seeding Sample Data..." -ForegroundColor Cyan
        if (Test-Path "seed-sample-reports.ps1") {
            .\seed-sample-reports.ps1
        } else {
            Write-Host "⚠️ Seed script 'seed-sample-reports.ps1' not found." -ForegroundColor Yellow
        }
    }

    "frontend" {
        Write-Host "Starting frontend development servers..." -ForegroundColor Cyan
        Write-Host "Make sure backend is running: .\runner.ps1 up" -ForegroundColor Yellow
        Write-Host ""
        
        # Check if npm dependencies are installed
        if (-not (Test-Path "client\web-warga\node_modules")) {
            Write-Host "Installing web-warga dependencies..." -ForegroundColor Yellow
            Push-Location "client\web-warga"
            npm install
            Pop-Location
        }
        
        if (-not (Test-Path "client\dashboard-dinas\node_modules")) {
            Write-Host "Installing dashboard-dinas dependencies..." -ForegroundColor Yellow
            Push-Location "client\dashboard-dinas"
            npm install
            Pop-Location
        }
        
        Write-Host "Starting frontend servers..." -ForegroundColor Green
        Write-Host "  Web Warga: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "  Dashboard Dinas: http://localhost:3001" -ForegroundColor Cyan
        Write-Host "`nPress Ctrl+C to stop" -ForegroundColor Yellow
        Write-Host ""
        
        # Run both frontend servers in parallel
        $webJob = Start-Job -ScriptBlock {
            param($root)
            Set-Location "$root\client\web-warga"
            npm run dev
        } -ArgumentList $script:ProjectRoot
        
        $dashJob = Start-Job -ScriptBlock {
            param($root)
            Set-Location "$root\client\dashboard-dinas"
            npm run dev
        } -ArgumentList $script:ProjectRoot
        
        # Wait and show output
        try {
            while ($true) {
                Receive-Job -Job $webJob -ErrorAction SilentlyContinue
                Receive-Job -Job $dashJob -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 100
            }
        } finally {
            Stop-Job -Job $webJob,$dashJob -ErrorAction SilentlyContinue
            Remove-Job -Job $webJob,$dashJob -ErrorAction SilentlyContinue
        }
    }
    
    "status" {
        Write-Host "Docker Services Status:" -ForegroundColor Cyan
        docker-compose ps
    }

    "help" {
        Write-Host "Citizen Reporting System - Runner Script" -ForegroundColor Cyan
        Write-Host "Available commands:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Setup (First Time):" -ForegroundColor Cyan
        Write-Host "  build        - Build Docker images for backend services" -ForegroundColor White
        Write-Host "  init-storage - Create MinIO buckets" -ForegroundColor White
        Write-Host "  seed         - Populate sample data" -ForegroundColor White
        Write-Host ""
        Write-Host "Start/Stop Services:" -ForegroundColor Cyan
        Write-Host "  up           - Start all backend services" -ForegroundColor White
        Write-Host "  down         - Stop all Docker services" -ForegroundColor White
        Write-Host "  restart      - Restart all services (Down + Up)" -ForegroundColor White
        Write-Host "  frontend     - Start frontend servers" -ForegroundColor White
        Write-Host "  status       - Check Docker container status" -ForegroundColor White
        Write-Host "  logs         - View real-time logs" -ForegroundColor White
        Write-Host ""
        Write-Host "Shortcuts:" -ForegroundColor Cyan
        Write-Host "  shell [db|mongo|mq] - Enter container terminal" -ForegroundColor White
    }
    
    Default {
        Write-Host "Unknown command. Use: .\runner.ps1 help" -ForegroundColor Red
    }
}