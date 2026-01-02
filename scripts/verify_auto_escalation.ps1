# Script to verify Automatic Escalation (SLA Breach)
# URL and Credentials
$AuthUrl = "http://localhost:8081"
$ReportUrl = "http://localhost:8082"
$Email = "verify_escalation@example.com"
$Password = "password123"
$Name = "Escalation Tester"

# 1. Register/Login
Write-Host "1. Authenticating..."
$loginPayload = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "$AuthUrl/api/auth/login" -Method Post -Body $loginPayload -ContentType "application/json" -ErrorAction Stop
} catch {
    # If login fails, try register
    $regPayload = @{ email = $Email; password = $Password; name = $Name; nik = "9999999999999999"; phone = "081234567890" } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$AuthUrl/api/auth/register" -Method Post -Body $regPayload -ContentType "application/json"
        $response = Invoke-RestMethod -Uri "$AuthUrl/api/auth/login" -Method Post -Body $loginPayload -ContentType "application/json"
    } catch {
        Write-Error "Login failed: $_"
        exit 1
    }
}
$token = $response.data.token
$headers = @{ Authorization = "Bearer $token" }

# 2. Create Report
Write-Host "2. Creating Report..."
$reportPayload = @{
    title = "Test Auto Escalation"
    description = "This report should be auto-escalated due to SLA breach."
    category = "Sampah"
    location = "Test Location"
    privacy = "public"
} | ConvertTo-Json

try {
    $createResp = Invoke-RestMethod -Uri "$ReportUrl/api/reports" -Method Post -Headers $headers -Body $reportPayload -ContentType "application/json"
    $reportID = $createResp.data.id
    Write-Host "Report Created: $reportID"
} catch {
    Write-Error "Failed to create report: $_"
    exit 1
}

# 3. Manipulate DB to expire SLA
Write-Host "3. Manipulating DB to simulate SLA breach..."
# Update sla_deadline to 1 hour ago
# Note: PowerShell variable interpolation inside the string
$cmd = "db.getSiblingDB('report_db').reports.updateOne({_id: ObjectId('$reportID')}, {`$set: {sla_deadline: new Date(new Date().getTime() - 3600000)}})"
Write-Host "Running Mongo Command: $cmd"

# Use docker exec to run mongo shell command
docker exec lapcw-mongo mongosh -u admin -p password --authenticationDatabase admin --eval "$cmd"

# 4. Wait for Worker (Ticker is 1 min)
Write-Host "4. Waiting for Auto-Escalation Worker (70 seconds)..."
Start-Sleep -Seconds 70

# 5. Verify Status
Write-Host "5. Verifying Report Status..."
try {
    $getResp = Invoke-RestMethod -Uri "$ReportUrl/api/reports/$reportID" -Method Get -Headers $headers
    $isEscalated = $getResp.data.is_escalated
    $escalatedBy = $getResp.data.escalated_by

    Write-Host "Report Status: is_escalated=$isEscalated, escalated_by=$escalatedBy"

    if ($isEscalated -eq $true -and $escalatedBy -eq "SYSTEM_AUTO_SLA") {
        Write-Host "SUCCESS: Report was auto-escalated!" -ForegroundColor Green
    } else {
        Write-Host "FAILURE: Report was NOT escalated." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Error "Failed to get report details: $_"
    exit 1
}
