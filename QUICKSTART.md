# ⚡ INICIO RÁPIDO

## 🚀 Ejecutar Localmente (Recomendado para desarrollo)

```powershell
# 1. Navegar al proyecto
cd \tmp\whatsapp-ghl-gateway

# 2. Instalar dependencias
npm install

# 3. Ejecutar
npm run dev
```

**El servidor estará en: http://localhost:8080**

---

## 🐳 Ejecutar con Docker

```powershell
# Construir y ejecutar
docker-compose up --build

# En segundo plano
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## 📋 Checklist Pre-Prueba

- ✅ Node.js 20+ instalado
- ✅ Puerto 8080 disponible
- ✅ WhatsApp en tu teléfono
- ✅ Postman instalado (o Insomnia/Thunder Client)
- ⚠️ Redis (opcional): Para procesar mensajes con colas. Sin Redis, los mensajes se encolarán pero no se procesarán.

---

## 🧪 Probar en 5 Minutos

### 1. Iniciar servidor
```powershell
npm run dev
```

### 2. Importar colección en Postman
- Archivo: `postman_collection.json`
- O crear requests manualmente

### 3. Generar QR
```
GET http://localhost:8080/api/wa/qr/wa-01
```

### 4. Escanear QR
- Copia el valor de `qr` de la respuesta
- Ve a: https://www.qr-code-generator.com/
- Pega y genera el QR
- Escanea con WhatsApp → Dispositivos Vinculados

### 5. Enviar mensaje (con cola H2)
```
POST http://localhost:8080/api/send
{
  "instanceId": "wa-01",
  "to": "+TU_NUMERO",
  "type": "text",
  "message": "Test con cola"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Mensaje text encolado para envío a +TU_NUMERO",
  "instanceId": "wa-01",
  "type": "text",
  "jobId": "wa-01-text-1234567890-abc123",
  "status": "queued"
}
```

### 6. Ver estadísticas de cola (H2)
```
GET http://localhost:8080/api/send/stats
```

---

## 📊 Verificar Persistencia (CLAVE)

1. Envía un mensaje exitosamente
2. **Detén** el servidor (Ctrl+C)
3. **Reinicia**: `npm run dev`
4. **Verifica estado**: GET /api/wa/status/wa-01
5. ✅ Debe estar `connected` SIN pedir QR

---

## 📁 Archivos Importantes

- `postman_collection.json` - Importar en Postman
- `TESTING.md` - Guía detallada de pruebas
- `README.md` - Documentación completa
- `H2_README.md` - Documentación de H2 (Colas y Logs)
- `.env` - Configuración
- `logs/` - Logs estructurados (Winston)

## 🆕 H2 - Características Nuevas

### Colas con BullMQ
- Envío asíncrono de mensajes
- Rate limiting automático (3-4s texto, 6-9s media)
- Reintentos automáticos

### Logs Estructurados
- Logs en `logs/combined.log` y `logs/error.log`
- Formato JSON estructurado
- Eventos rastreables

### Redis (Opcional)
Para desarrollo completo, instala Redis:
```powershell
# Con Docker
docker run -d -p 6379:6379 redis:latest
```

Sin Redis, los mensajes se encolarán pero no se procesarán automáticamente.

---

## 🆘 Problemas?

Ver `TESTING.md` sección "Errores Comunes"
