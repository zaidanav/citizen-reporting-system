# Script untuk Create Admin Users
# Run: .\create-admin.ps1

$baseUrl = "http://localhost:8081"

Write-Host "Creating/Updating Admin Users..." -ForegroundColor Cyan

# First, add access_role column if it doesn't exist
Write-Host "`nAdding access_role column to users table..." -ForegroundColor Yellow
docker exec lapcw-postgres psql -U admin -d auth_db -c "ALTER TABLE users ADD COLUMN access_role TEXT DEFAULT 'operational';" 2>&1 | Where-Object { $_ -notmatch "already exists|^$" }
Write-Host "[OK] access_role column ready" -ForegroundColor Green

$admins = @(
    @{
        email = "admin@dinas.com"
        password = "admin123"
        name = "Admin Umum"
        department = "general"
        access_role = "operational"
    },
    @{
        email = "pimpinan@dinas.com"
        password = "admin123"
        name = "Pimpinan Dinas"
        department = "general"
        access_role = "strategic"
    },
    @{
        email = "kebersihan@dinas.com"
        password = "admin123"
        name = "Admin Kebersihan"
        department = "Kebersihan"
        access_role = "operational"
    },
    @{
        email = "pekerjaanumum@dinas.com"
        password = "admin123"
        name = "Admin Pekerjaan Umum"
        department = "Pekerjaan Umum"
        access_role = "operational"
    },
    @{
        email = "penerangan@dinas.com"
        password = "admin123"
        name = "Admin Penerangan"
        department = "Penerangan Jalan"
        access_role = "operational"
    },
    @{
        email = "lingkungan@dinas.com"
        password = "admin123"
        name = "Admin Lingkungan Hidup"
        department = "Lingkungan Hidup"
        access_role = "operational"
    },
    @{
        email = "perhubungan@dinas.com"
        password = "admin123"
        name = "Admin Perhubungan"
        department = "Perhubungan"
        access_role = "operational"
    }
)

foreach ($admin in $admins) {
    $email = $admin.email
    $name = $admin.name
    $dept = $admin.department
    $access = $admin.access_role
    
    Write-Host "`n- $email ($access)" -ForegroundColor Yellow
    
    # Check if user exists
    $sql = "SELECT COUNT(*) FROM users WHERE email = '$email';"
    $result = docker exec lapcw-postgres psql -U admin -d auth_db -t -c $sql
    
    if ($result -match "0") {
        # Create user
        $nikHash = Get-Random -Minimum 1000000000 -Maximum 9999999999
        $body = @{
            email = $email
            password = $admin.password
            name = $name
            nik = $nikHash.ToString()
            phone = "081234567890"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
            Write-Host "  [Created] $name" -ForegroundColor Green
        } catch {
            Write-Host "  [Error] Create failed" -ForegroundColor Red
        }
    } else {
        Write-Host "  [Exists] Already in database" -ForegroundColor Gray
    }
    
    # Update role, department, and access_role
    $updateSql = "UPDATE users SET role = 'admin', department = '$dept', access_role = '$access' WHERE email = '$email';"
    docker exec lapcw-postgres psql -U admin -d auth_db -c $updateSql | Out-Null
    Write-Host "  [Updated] admin | $dept | $access" -ForegroundColor Green
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Admin Users Ready for Testing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nOperational Access (Dashboard + Eskalasi):" -ForegroundColor Yellow
Write-Host "  admin@dinas.com" -ForegroundColor White
Write-Host "  kebersihan@dinas.com" -ForegroundColor White
Write-Host "  pekerjaanumum@dinas.com" -ForegroundColor White
Write-Host "  penerangan@dinas.com" -ForegroundColor White
Write-Host "  lingkungan@dinas.com" -ForegroundColor White
Write-Host "  perhubungan@dinas.com" -ForegroundColor White

Write-Host "`nStrategic Access (Dashboard + Eskalasi + Analytics) [RECOMMENDED]:" -ForegroundColor Cyan
Write-Host "  pimpinan@dinas.com" -ForegroundColor White

Write-Host "`nPassword untuk semua akun: admin123" -ForegroundColor White
Write-Host "`nURL: http://localhost:3001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


