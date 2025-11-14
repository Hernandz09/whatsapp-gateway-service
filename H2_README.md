# 🚀 H2 - Envío y Recepción con Colas

## ✅ Implementación Completada

### Características Implementadas

1. **✅ Cola de envío con BullMQ**
   - Sistema de colas robusto usando BullMQ
   - Procesamiento asíncrono de mensajes
   - Reintentos automáticos en caso de fallo
   - Limpieza automática de jobs completados/fallidos

2. **✅ Rate Limiting Inteligente**
   - **Texto**: Delay aleatorio entre 3-4 segundos
   - **Media/Imagen**: Delay aleatorio entre 6-9 segundos
   - Delays calculados automáticamente al encolar

3. **✅ Logs Estructurados con Winston**
   - Logs en formato JSON estructurado
   - Archivos separados: `logs/error.log` y `logs/combined.log`
   - Logs en consola con formato legible en desarrollo
   - Eventos estructurados para fácil análisis

4. **✅ Persistencia de Sesión**
   - Ya implementada en H1
   - Sesiones guardadas por `instanceId`
   - Reconexión automática

---

## 📋 Configuración

### Variables de Entorno

Crea un archivo `.env` con:

```env
# Puerto del servidor
PORT=8080

# Directorio de sesiones
SESSION_DIR=./data/sessions

# Redis (opcional para desarrollo)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Nivel de logs
LOG_LEVEL=info
```

### Redis (Opcional)

**Para desarrollo local sin Redis:**
- El sistema funcionará pero los mensajes no se procesarán
- Los mensajes se encolarán pero el worker no los procesará sin Redis

**Para producción o desarrollo completo:**
1. Instalar Redis localmente o usar Redis en la nube
2. Configurar las variables `REDIS_HOST` y `REDIS_PORT`
3. El worker se conectará automáticamente

**Instalar Redis localmente (Windows):**
```powershell
# Opción 1: Docker
docker run -d -p 6379:6379 redis:latest

# Opción 2: WSL
# Instalar Redis en WSL
```

---

## 🔌 Endpoints

### Enviar Mensaje (con Cola)

```http
POST /api/send
Content-Type: application/json

{
  "instanceId": "wa-01",
  "to": "+51999999999",
  "type": "text",
  "message": "Hola desde GHL 🚀"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Mensaje text encolado para envío a +51999999999",
  "instanceId": "wa-01",
  "type": "text",
  "jobId": "wa-01-text-1234567890-abc123",
  "status": "queued"
}
```

### Enviar Imagen

```http
POST /api/send
Content-Type: application/json

{
  "instanceId": "wa-01",
  "to": "+51999999999",
  "type": "image",
  "mediaUrl": "https://picsum.photos/400"
}
```

### Estadísticas de Cola

```http
GET /api/send/stats
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "waiting": 5,
    "active": 1,
    "completed": 120,
    "failed": 2,
    "delayed": 3,
    "total": 131
  }
}
```

---

## 📊 Logs Estructurados

Los logs se guardan en:
- `logs/error.log` - Solo errores
- `logs/combined.log` - Todos los logs

### Ejemplo de Log Estructurado

```json
{
  "timestamp": "2025-11-14 03:45:00",
  "level": "info",
  "message": "Mensaje encolado",
  "event": "message.queue",
  "instanceId": "wa-01",
  "jobId": "wa-01-text-1234567890-abc123",
  "type": "text",
  "delay": 3500,
  "service": "whatsapp-ghl-gateway"
}
```

### Eventos Registrados

- `message.queue` - Mensaje encolado
- `message.send` - Mensaje enviado (con estados: queued, processing, sent, failed)
- `message.receive` - Mensaje recibido
- `connection.update` - Cambio de estado de conexión
- `queue.worker.ready` - Worker de colas listo
- `queue.worker.error` - Error en worker

---

## 🧪 Pruebas

### 1. Enviar múltiples mensajes de texto

```bash
# Enviar 5 mensajes seguidos
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/send \
    -H "Content-Type: application/json" \
    -d "{\"instanceId\":\"wa-01\",\"to\":\"+51999999999\",\"type\":\"text\",\"message\":\"Mensaje $i\"}"
done
```

**Resultado esperado:**
- Todos los mensajes se encolan inmediatamente
- Se procesan con delay de 3-4 segundos entre cada uno
- Los logs muestran el procesamiento secuencial

### 2. Verificar estadísticas

```bash
curl http://localhost:8080/api/send/stats
```

### 3. Revisar logs

```bash
# Ver logs en tiempo real
tail -f logs/combined.log

# Ver solo errores
tail -f logs/error.log
```

---

## 🔍 Troubleshooting

### Los mensajes no se procesan

1. **Verificar Redis:**
   ```bash
   redis-cli ping
   # Debe responder: PONG
   ```

2. **Verificar logs del worker:**
   - Revisar `logs/error.log` para errores de conexión
   - Verificar que el worker esté activo en la consola

3. **Verificar estado de la cola:**
   ```bash
   GET /api/send/stats
   ```

### Redis no disponible

Si Redis no está disponible:
- Los mensajes se encolarán pero no se procesarán
- Verás un warning en la consola al iniciar
- Instala Redis o usa un servicio en la nube (Redis Cloud, Upstash, etc.)

---

## 📝 Notas Técnicas

### Rate Limiting

- Los delays se calculan **al encolar** el mensaje
- Cada mensaje tiene su propio delay basado en su tipo
- Los mensajes se procesan secuencialmente (concurrency: 1)
- El rate limiting global es de 1 mensaje por segundo

### Persistencia

- Los jobs completados se mantienen por 1 hora
- Los jobs fallidos se mantienen por 24 horas
- Límite de 1000 jobs completados en memoria

### Worker

- Procesa un mensaje a la vez (concurrency: 1)
- Reintenta hasta 3 veces en caso de fallo
- Backoff exponencial en reintentos (2s, 4s, 8s)

---

## 🎯 Próximos Pasos (H3)

- [ ] Recepción de mensajes con webhooks
- [ ] Soporte para más tipos de media (audio, video, documentos)
- [ ] Dashboard de monitoreo de colas
- [ ] Métricas y alertas

