param(
    [Parameter(Position=0)]
    [string]$Task = "help",

    [Parameter(Position=1)]
    [string]$Target = "" 
)

function Show-AccessInfo {
    Write-Host "`n✅ Services are UP & Running! Access them here:" -ForegroundColor Cyan
    Write-Host "===========================================================" -ForegroundColor Gray
    
    # RabbitMQ
    Write-Host " 🐰 RabbitMQ Console : " -NoNewline; Write-Host "http://localhost:15672" -ForegroundColor Green
    Write-Host "    (User: guest | Pass: guest)" -ForegroundColor DarkGray
    
    # MinIO
    Write-Host " 🗄️  MinIO Console    : " -NoNewline; Write-Host "http://localhost:9001" -ForegroundColor Green
    Write-Host "    (User: minioadmin | Pass: minioadmin)" -ForegroundColor DarkGray
    
    # Grafana
    Write-Host " 📊 Grafana Dash     : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Green
    Write-Host "    (User: admin | Pass: admin)" -ForegroundColor DarkGray
    
    # Prometheus
    Write-Host " 📈 Prometheus       : " -NoNewline; Write-Host "http://localhost:9090" -ForegroundColor Green
    Write-Host "    (Monitoring Metrics)" -ForegroundColor DarkGray

    # Database Info
    Write-Host "`n 🛢️  Database Connections:" -ForegroundColor Yellow
    Write-Host "    🐘 Postgres : localhost:5432  (User: admin | Pass: password)" -ForegroundColor Gray
    Write-Host "    🍃 MongoDB  : localhost:27017 (User: admin | Pass: password)" -ForegroundColor Gray

    # Backend Services
    Write-Host "`n ⚙️  Backend Services:" -ForegroundColor Yellow
    Write-Host "    🔐 Auth Service   : " -NoNewline; Write-Host "$AuthServiceUrl" -ForegroundColor Green
    Write-Host "    📝 Report Service : " -NoNewline; Write-Host "$ReportServiceUrl" -ForegroundColor Green
    Write-Host "    📬 Dispatcher Service : " -NoNewline; Write-Host "Running (Background Worker)" -ForegroundColor Cyan
    
    Write-Host "===========================================================" -ForegroundColor Gray
}

# --- Main Logic ---
Write-Host "🔧 Running Task: `$Task" -ForegroundColor Cyan

switch ($Task) {
    "up" { 
        docker-compose up -d
        if ($LASTEXITCODE -eq 0) { Show-AccessInfo }
    }
    "down" { 
        docker-compose down
        Write-Host "🛑 Services stopped." -ForegroundColor Yellow
    }
    "restart" {
        docker-compose down
        docker-compose up -d
        if ($LASTEXITCODE -eq 0) { Show-AccessInfo }
    }
    "logs" {
        docker-compose logs -f
    }
    "ps" {
        docker-compose ps
    }
    
    "shell" {
        if ([string]::IsNullOrWhiteSpace($Target)) {
            Write-Host "⚠️  Error: Sebutkan target service." -ForegroundColor Red
            Write-Host "   Usage: .\runner.ps1 shell [postgres|mongo|rabbit|minio]" -ForegroundColor Yellow
            return
        }

        $ContainerName = ""
        $ShellCmd = "/bin/sh"

        switch ($Target) {
            "postgres" { $ContainerName = "lapcw-postgres"; $ShellCmd = "sh" }
            "db"       { $ContainerName = "lapcw-postgres"; $ShellCmd = "sh" } 
            "mongo"    { $ContainerName = "lapcw-mongo";    $ShellCmd = "bash" }
            "rabbit"   { $ContainerName = "lapcw-rabbitmq"; $ShellCmd = "sh" }
            "mq"       { $ContainerName = "lapcw-rabbitmq"; $ShellCmd = "sh" }
            "minio"    { $ContainerName = "lapcw-minio";    $ShellCmd = "sh" }
            "s3"       { $ContainerName = "lapcw-minio";    $ShellCmd = "sh" }
            
            "grafana"  { $ContainerName = "lapcw-grafana";  $ShellCmd = "bash" }
            "auth"       { $ContainerName = "lapcw-auth-service";       $ShellCmd = "sh" }
            "report"     { $ContainerName = "lapcw-report-service";     $ShellCmd = "sh" }
            "dispatcher" { $ContainerName = "lapcw-dispatcher-service"; $ShellCmd = "sh" }

            Default {
                Write-Host "❌ Target '$Target' tidak dikenal." -ForegroundColor Red
                Write-Host "   Available: postgres, mongo, rabbit, minio, auth, report, dispatcher" -ForegroundColor Gray
                return
            }
        }

        Write-Host "🚀 Masuk ke container: $ContainerName ($ShellCmd)..." -ForegroundColor Cyan
        docker exec -it $ContainerName $ShellCmd
    }
    
    "link" {
        Show-AccessInfo
    }

    "init-storage" {
        Write-Host "🗄️  Configuring MinIO Storage..." -ForegroundColor Cyan
        
        if (!(docker ps -q -f name=lapcw-minio)) {
            Write-Host "❌ Container MinIO not running. Run 'up' first!" -ForegroundColor Red
            return
        }

        docker exec lapcw-minio mc alias set local http://localhost:9000 minioadmin minioadmin | Out-Null
        docker exec lapcw-minio mc mb local/laporan-warga --ignore-existing | Out-Null
        Write-Host "   - Bucket 'laporan-warga' ensured." -ForegroundColor Gray

        docker exec lapcw-minio mc anonymous set public local/laporan-warga
        Write-Host "✅ Success! Bucket 'laporan-warga' is now PUBLIC." -ForegroundColor Green
    }

    Default {
        Write-Host "------------------------------------------------"
        Write-Host "Available Tasks:"
        Write-Host "  up             : Start infrastructure"
        Write-Host "  down           : Stop infrastructure"
        Write-Host "  shell [name]   : Access container (Ex: shell postgres)"
        Write-Host "  logs           : View logs"
        Write-Host "  ps             : Check status"
        Write-Host "  link           : Show access info"
        Write-Host "  init-storage   : Initialize MinIO storage"
        Write-Host "------------------------------------------------"
        Write-Host "Example: .\runner.ps1 shell mongo" -ForegroundColor Yellow
    }
}