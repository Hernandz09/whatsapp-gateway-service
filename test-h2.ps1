# Script de prueba para H2 - Colas y Logs
# Uso: .\test-h2.ps1

$baseUrl = "http://localhost:8080"
$instanceId = "wa-01"
$testNumber = Read-Host "Ingresa el número de teléfono para pruebas (ej: +51999999999)"

Write-Host "`n🧪 Iniciando pruebas de H2...`n" -ForegroundColor Cyan

# 1. Verificar que el servidor esté corriendo
Write-Host "1️⃣ Verificando servidor..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/" -Method Get
    Write-Host "✅ Servidor activo: $($response.service)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: El servidor no está corriendo. Ejecuta 'npm run dev' primero." -ForegroundColor Red
    exit 1
}

# 2. Verificar estado de conexión
Write-Host "`n2️⃣ Verificando estado de conexión..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$baseUrl/api/wa/status/$instanceId" -Method Get
    if ($status.status -eq "connected") {
        Write-Host "✅ Instancia conectada: $instanceId" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Instancia no conectada. Estado: $($status.status)" -ForegroundColor Yellow
        Write-Host "   Genera el QR primero con: GET $baseUrl/api/wa/qr/$instanceId" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Error al verificar estado" -ForegroundColor Red
    exit 1
}

# 3. Verificar estadísticas de cola
Write-Host "`n3️⃣ Verificando estadísticas de cola..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/api/send/stats" -Method Get
    Write-Host "✅ Estadísticas de cola:" -ForegroundColor Green
    Write-Host "   - Esperando: $($stats.stats.waiting)" -ForegroundColor White
    Write-Host "   - Activos: $($stats.stats.active)" -ForegroundColor White
    Write-Host "   - Completados: $($stats.stats.completed)" -ForegroundColor White
    Write-Host "   - Fallidos: $($stats.stats.failed)" -ForegroundColor White
} catch {
    Write-Host "⚠️  No se pudieron obtener estadísticas (Redis puede no estar disponible)" -ForegroundColor Yellow
}

# 4. Enviar mensaje de texto
Write-Host "`n4️⃣ Enviando mensaje de texto..." -ForegroundColor Yellow
try {
    $body = @{
        instanceId = $instanceId
        to = $testNumber
        type = "text"
        message = "🧪 Test H2 - Mensaje con cola $(Get-Date -Format 'HH:mm:ss')"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$baseUrl/api/send" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ Mensaje encolado exitosamente!" -ForegroundColor Green
    Write-Host "   Job ID: $($result.jobId)" -ForegroundColor White
    Write-Host "   Estado: $($result.status)" -ForegroundColor White
} catch {
    Write-Host "❌ Error al enviar mensaje: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Esperar y verificar estadísticas nuevamente
Write-Host "`n5️⃣ Esperando 5 segundos y verificando procesamiento..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/api/send/stats" -Method Get
    Write-Host "✅ Estadísticas actualizadas:" -ForegroundColor Green
    Write-Host "   - Esperando: $($stats.stats.waiting)" -ForegroundColor White
    Write-Host "   - Activos: $($stats.stats.active)" -ForegroundColor White
    Write-Host "   - Completados: $($stats.stats.completed)" -ForegroundColor White
} catch {
    Write-Host "⚠️  No se pudieron obtener estadísticas" -ForegroundColor Yellow
}

# 6. Verificar logs
Write-Host "`n6️⃣ Verificando logs..." -ForegroundColor Yellow
if (Test-Path "logs\combined.log") {
    Write-Host "✅ Archivo de logs encontrado: logs\combined.log" -ForegroundColor Green
    $logLines = Get-Content "logs\combined.log" -Tail 5
    Write-Host "   Últimas 5 líneas:" -ForegroundColor White
    $logLines | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "⚠️  Archivo de logs no encontrado aún" -ForegroundColor Yellow
}

Write-Host "`n✅ Pruebas completadas!`n" -ForegroundColor Green
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "   - Revisa logs\combined.log para ver logs estructurados" -ForegroundColor White
Write-Host "   - Revisa logs\error.log para ver solo errores" -ForegroundColor White
Write-Host "   - Si los mensajes no se procesan, verifica que Redis esté corriendo" -ForegroundColor White

