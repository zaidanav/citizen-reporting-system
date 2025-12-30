param(
    [Parameter(Position=0)]
    [string]$Task = "help"
)

$script:BackendJobs = @()
$script:FrontendJobs = @()
$script:ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Running Task: $Task" -ForegroundColor Cyan

switch ($Task) {
    "build" {
        Write-Host "Building all services..." -ForegroundColor Cyan
        
        # Build Backend Services
        Write-Host "`n[1/3] Building Backend Services..." -ForegroundColor Yellow
        $services = @("auth-service", "report-service", "notification-service", "dispatcher-service")
        foreach ($service in $services) {
            Write-Host "  - Building $service..." -ForegroundColor Gray
            Push-Location "services\$service"
            go build -o "../../build/$service.exe" .
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    Success: $service" -ForegroundColor Green
            } else {
                Write-Host "    Failed: $service" -ForegroundColor Red
            }
            Pop-Location
        }
        
        # Build Frontend - Web Warga
        Write-Host "`n[2/3] Building Web Warga..." -ForegroundColor Yellow
        Push-Location "client\web-warga"
        npm run build
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Success: Web Warga built to dist/" -ForegroundColor Green
        } else {
            Write-Host "  Failed: Web Warga build" -ForegroundColor Red
        }
        Pop-Location
        
        # Build Frontend - Dashboard Dinas
        Write-Host "`n[3/3] Building Dashboard Dinas..." -ForegroundColor Yellow
        Push-Location "client\dashboard-dinas"
        npm run build
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Success: Dashboard Dinas built to dist/" -ForegroundColor Green
        } else {
            Write-Host "  Failed: Dashboard Dinas build" -ForegroundColor Red
        }
        Pop-Location
        
        Write-Host "`nBuild complete!" -ForegroundColor Cyan
        Write-Host "Backend binaries: build/" -ForegroundColor Gray
        Write-Host "Web Warga: client/web-warga/dist/" -ForegroundColor Gray
        Write-Host "Dashboard Dinas: client/dashboard-dinas/dist/" -ForegroundColor Gray
        Write-Host "`nNote: To use these builds in Docker, run: .\runner.ps1 docker-build" -ForegroundColor Yellow
    }
    
    "docker-build" {
        Write-Host "Building Docker images for backend services..." -ForegroundColor Cyan
        
        Write-Host "`nStopping existing containers..." -ForegroundColor Yellow
        docker-compose down
        
        Write-Host "`nBuilding Docker images..." -ForegroundColor Yellow
        docker-compose build --no-cache auth-service report-service notification-service dispatcher-service
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nDocker images built successfully!" -ForegroundColor Green
            Write-Host "Start services with: .\runner.ps1 up" -ForegroundColor Cyan
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
    
    "help" {
        Write-Host "Citizen Reporting System - Runner Script" -ForegroundColor Cyan
        Write-Host "Available commands:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Build Commands:" -ForegroundColor Cyan
        Write-Host "  build        - Build backend/frontend locally (for dev)" -ForegroundColor White
        Write-Host "  docker-build - Build Docker images (for production)" -ForegroundColor White
        Write-Host ""
        Write-Host "Docker Commands:" -ForegroundColor Cyan
        Write-Host "  up           - Start all services with Docker" -ForegroundColor White
        Write-Host "  down         - Stop all Docker services" -ForegroundColor White
        Write-Host "  status       - Check service status" -ForegroundColor White
        Write-Host ""
        Write-Host "Development Commands:" -ForegroundColor Cyan
        Write-Host "  dev          - Start full dev environment (local)" -ForegroundColor White
        Write-Host "  backend      - Start backend services only (local)" -ForegroundColor White
        Write-Host "  frontend     - Start frontend apps only (local)" -ForegroundColor White
        Write-Host "  stop         - Stop all local services" -ForegroundColor White
    }
    
    "dev" {
        Write-Host "Starting full development environment..." -ForegroundColor Cyan
        Write-Host "Note: This runs from source code (go run)" -ForegroundColor Yellow
        Write-Host "For production Docker deployment, use: .\runner.ps1 docker-build && .\runner.ps1 up" -ForegroundColor Yellow
        Write-Host "`nStarting infrastructure..." -ForegroundColor Cyan
        docker-compose up -d postgres mongo rabbitmq minio
        Start-Sleep -Seconds 5
        
        Write-Host "`nStarting backend services..." -ForegroundColor Cyan
        $services = @(
            @{Name="auth-service"; Port=8081},
            @{Name="report-service"; Port=8082},
            @{Name="notification-service"; Port=8084},
            @{Name="dispatcher-service"; Port=0}
        )
        
        foreach ($svc in $services) {
            Write-Host "  Starting $($svc.Name)..." -ForegroundColor Gray
            $job = Start-Job -ScriptBlock {
                param($path)
                Set-Location $path
                go run main.go
            } -ArgumentList "services\$($svc.Name)"
            $script:BackendJobs += $job
        }
        
        Write-Host "`nStarting frontend apps..." -ForegroundColor Cyan
        Write-Host "  Starting web-warga (port 3000)..." -ForegroundColor Gray
        $webJob = Start-Job -ScriptBlock {
            param($root)
            Set-Location "$root\client\web-warga"
            npm run dev
        } -ArgumentList $script:ProjectRoot
        $script:FrontendJobs += $webJob
        
        Write-Host "  Starting dashboard-dinas (port 3001)..." -ForegroundColor Gray
        $dashJob = Start-Job -ScriptBlock {
            param($root)
            Set-Location "$root\client\dashboard-dinas"
            npm run dev
        } -ArgumentList $script:ProjectRoot
        $script:FrontendJobs += $dashJob
        
        Write-Host "`nAll services starting..." -ForegroundColor Green
        Write-Host "Frontend apps will be available in ~30 seconds" -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
    }
    
    "backend" {
        Write-Host "Starting backend services only..." -ForegroundColor Cyan
        Write-Host "Make sure infrastructure is running: .\runner.ps1 up" -ForegroundColor Yellow
        
        $services = @("auth-service", "report-service", "notification-service", "dispatcher-service")
        foreach ($svc in $services) {
            Write-Host "  Starting $svc..." -ForegroundColor Gray
            $job = Start-Job -ScriptBlock {
                param($path)
                Set-Location $path
                go run main.go
            } -ArgumentList "services\$svc"
            $script:BackendJobs += $job
        }
        
        Write-Host "`nBackend services started!" -ForegroundColor Green
    }
    
    "frontend" {
        Write-Host "Starting frontend apps only..." -ForegroundColor Cyan
        
        Write-Host "  Starting web-warga (port 3000)..." -ForegroundColor Gray
        $webJob = Start-Job -ScriptBlock {
            param($root)
            Set-Location "$root\client\web-warga"
            npm run dev
        } -ArgumentList $script:ProjectRoot
        $script:FrontendJobs += $webJob
        
        Write-Host "  Starting dashboard-dinas (port 3001)..." -ForegroundColor Gray
        $dashJob = Start-Job -ScriptBlock {
            param($root)
            Set-Location "$root\client\dashboard-dinas"
            npm run dev
        } -ArgumentList $script:ProjectRoot
        $script:FrontendJobs += $dashJob
        
        Write-Host "`nFrontend apps started!" -ForegroundColor Green
        Write-Host "  Web Warga: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "  Dashboard Dinas: http://localhost:3001" -ForegroundColor Cyan
    }
    
    "stop" {
        Write-Host "Stopping all local services..." -ForegroundColor Yellow
        
        if ($script:BackendJobs.Count -gt 0) {
            Write-Host "  Stopping backend jobs..." -ForegroundColor Gray
            $script:BackendJobs | Stop-Job -ErrorAction SilentlyContinue
            $script:BackendJobs | Remove-Job -ErrorAction SilentlyContinue
            $script:BackendJobs = @()
        }
        
        if ($script:FrontendJobs.Count -gt 0) {
            Write-Host "  Stopping frontend jobs..." -ForegroundColor Gray
            $script:FrontendJobs | Stop-Job -ErrorAction SilentlyContinue
            $script:FrontendJobs | Remove-Job -ErrorAction SilentlyContinue
            $script:FrontendJobs = @()
        }
        
        Write-Host "`nAll local services stopped!" -ForegroundColor Green
    }
    
    "status" {
        Write-Host "Checking service status..." -ForegroundColor Cyan
        docker-compose ps
        
        Write-Host "`nLocal Jobs:" -ForegroundColor Yellow
        Write-Host "  Backend jobs: $($script:BackendJobs.Count)" -ForegroundColor Gray
        Write-Host "  Frontend jobs: $($script:FrontendJobs.Count)" -ForegroundColor Gray
    }
    
    Default {
        Write-Host "Unknown command. Use: .\runner.ps1 help" -ForegroundColor Red
    }
}
