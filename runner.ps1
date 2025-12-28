param(
    [string]$Task = "help"
)

Write-Host "🔧 Running Task: $Task" -ForegroundColor Cyan

switch ($Task) {
    "up" { 
        docker-compose up -d
        Write-Host "🚀 Services are up!" -ForegroundColor Green
    }
    "down" { 
        docker-compose down
        Write-Host "🛑 Services stopped." -ForegroundColor Yellow
    }
    "logs" {
        docker-compose logs -f
    }
    "restart" {
        docker-compose down
        docker-compose up -d
        Write-Host "🔄 Services restarted." -ForegroundColor Green
    }
    "ps" {
        docker-compose ps
    }
    Default {
        Write-Host "------------------------------------------------"
        Write-Host "Available Tasks:"
        Write-Host "  up      : Start infrastructure (Docker Compose)"
        Write-Host "  down    : Stop infrastructure"
        Write-Host "  restart : Restart infrastructure"
        Write-Host "  logs    : View logs"
        Write-Host "  ps      : Check container status"
        Write-Host "------------------------------------------------"
        Write-Host "Example: .\runner.ps1 -Task up" -ForegroundColor Yellow
    }
}
