# Script untuk Create Admin Users

$baseUrl = "http://localhost:8081"

Write-Host "🔧 Creating Admin Users..." -ForegroundColor Cyan

try {
    docker exec lapcw-postgres psql -U admin -d auth_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_role TEXT DEFAULT 'operational';" 2>&1 | Out-Null
} catch {}

$admins = @(
    @{ email = "admin@dinas.com"; name = "Admin Umum"; dept = "general"; access = "operational" },
    @{ email = "superadmin@dinas.com"; name = "Super Admin"; dept = "general"; access = "strategic"; role = "super-admin" },
    @{ email = "pimpinan@dinas.com"; name = "Pimpinan Dinas"; dept = "general"; access = "strategic" },
    @{ email = "kebersihan@dinas.com"; name = "Admin Kebersihan"; dept = "Kebersihan"; access = "operational" },
    @{ email = "pekerjaanumum@dinas.com"; name = "Admin Pekerjaan Umum"; dept = "Pekerjaan Umum"; access = "operational" },
    @{ email = "penerangan@dinas.com"; name = "Admin Penerangan"; dept = "Penerangan Jalan"; access = "operational" },
    @{ email = "lingkungan@dinas.com"; name = "Admin Lingkungan Hidup"; dept = "Lingkungan Hidup"; access = "operational" },
    @{ email = "perhubungan@dinas.com"; name = "Admin Perhubungan"; dept = "Perhubungan"; access = "operational" }
)

foreach ($admin in $admins) {
    $email = $admin.email
    $role = if ($admin.ContainsKey('role')) { $admin.role } else { 'admin' }
    
    Write-Host "`nProcessing: $email" -ForegroundColor Yellow
    
    # Cek user di DB
    $exists = docker exec lapcw-postgres psql -U admin -d auth_db -t -c "SELECT COUNT(*) FROM users WHERE email = '$email';"
    
    if ($exists -match "0") {
        $nikString = -join ((1..16) | ForEach-Object { Get-Random -Minimum 0 -Maximum 9 })
        
        $body = @{
            email = $email
            password = "admin123"
            name = $admin.name
            nik = $nikString
            phone = "081234567890"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
            Write-Host "   ✅ [Created] Registered as Citizen" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ [Failed] Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
            
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                Write-Host "   📄 REASON: $($reader.ReadToEnd())" -ForegroundColor Red
            } catch {}
        }
    } else {
        Write-Host "   ℹ️  [Exists] User already exists" -ForegroundColor Gray
    }
    
    if ($exists -notmatch "0" -or $?) { 
        $sql = "UPDATE users SET role = '$role', department = '$($admin.dept)', access_role = '$($admin.access)' WHERE email = '$email';"
        docker exec lapcw-postgres psql -U admin -d auth_db -c $sql > $null 2>&1
        Write-Host "   🔄 [Promoted] Updated to $role | $($admin.dept)" -ForegroundColor Cyan
    }
}

Write-Host "`n"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 🎉 Admin Setup Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan