# Script untuk seed sample reports (MongoDB)
# Run: .\seed-sample-reports.ps1

$mongoUser = $env:MONGO_USER; if (-not $mongoUser) { $mongoUser = "admin" }
$mongoPass = $env:MONGO_PASSWORD; if (-not $mongoPass) { $mongoPass = "password" }

$uri = "mongodb://$mongoUser`:$mongoPass@localhost:27017/report_db?authSource=admin"

# Use verbose labels that match current report creation logic,
# while the performance endpoint normalizes these into canonical keys.
$departments = @(
  "DINAS KEBERSIHAN",
  "DINAS PU (PEKERJAAN UMUM)",
  "DINAS PENERANGAN JALAN",
  "DINAS LINGKUNGAN HIDUP",
  "DINAS PERHUBUNGAN",
  "KEPOLISIAN / SATPOL PP",
  "PEMDA PUSAT (KATEGORI UMUM)"
)

$statuses = @("PENDING", "IN_PROGRESS", "RESOLVED")

function New-RandomReportDoc($i) {
  $dept = Get-Random -InputObject $departments
  $status = Get-Random -InputObject $statuses
  $daysAgo = Get-Random -Minimum 0 -Maximum 30
  $createdAt = (Get-Date).AddDays(-1 * $daysAgo)

  # process_time_hours just for performance aggregation demo
  $processTime = if ($status -eq "RESOLVED") { [math]::Round((Get-Random -Minimum 1 -Maximum 72) + (Get-Random), 2) } else { [math]::Round((Get-Random -Minimum 0 -Maximum 24) + (Get-Random), 2) }
  $upvotes = Get-Random -Minimum 0 -Maximum 50

  return @{
    title = "Sample Report #$i"
    description = "Generated sample report for dashboard testing"
    category = "Sampah"
    location = "Kota"
    is_anonymous = $false
    is_public = $true
    assigned_departments = @($dept)
    reporter_id = "seed-user"
    reporter_name = "Seeder"
    image_url = ""
    status = $status
    upvotes = $upvotes
    created_at = $createdAt.ToString("o")
    updated_at = $createdAt.ToString("o")
    is_escalated = $false
    process_time_hours = $processTime
  }
}

$docs = @()
for ($i = 1; $i -le 40; $i++) {
  $docs += (New-RandomReportDoc $i)
}

# Build JS for mongosh
$docsJson = ($docs | ConvertTo-Json -Depth 6)

# Convert ISO strings -> ISODate in mongosh for created_at/updated_at
$js = @"
const docs = $docsJson;
for (const d of docs) {
  d.created_at = new Date(d.created_at);
  d.updated_at = new Date(d.updated_at);
}
const result = db.getSiblingDB('report_db').reports.insertMany(docs);
const count = result && result.insertedIds ? Object.keys(result.insertedIds).length : 0;
print("Inserted: " + count);
"@

Write-Host "Seeding sample reports into Mongo..." -ForegroundColor Cyan
Write-Host "Mongo URI: $uri" -ForegroundColor DarkGray

# Avoid quoting/escaping issues on Windows by running a script file in the container
$tmpJsPath = Join-Path $env:TEMP "seed-sample-reports.js"
Set-Content -Path $tmpJsPath -Value $js -Encoding UTF8

docker cp $tmpJsPath "lapcw-mongo:/tmp/seed-sample-reports.js" | Out-Null
docker exec lapcw-mongo mongosh "$uri" --quiet /tmp/seed-sample-reports.js

Remove-Item $tmpJsPath -ErrorAction SilentlyContinue

Write-Host "[OK] Done. Now open Performance page (Super Admin) and refresh." -ForegroundColor Green
