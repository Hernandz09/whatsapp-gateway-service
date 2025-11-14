# 🚀 WhatsApp GHL Gateway - Hito 1 (H1)

Gateway WhatsApp con conexión QR estable y sesión persistente.

## ⚡ Inicio Rápido

### Opción 1: Sin Docker (Local)

```powershell
# 1. Instalar dependencias
npm install

# 2. Ejecutar en modo desarrollo
npm run dev
```

### Opción 2: Con Docker

```powershell
# Construir y ejecutar
docker-compose up --build
```

El servidor estará disponible en: **http://localhost:8080**

---

## 📋 Endpoints API para Postman

### 1️⃣ **Generar QR Code**

```
GET http://localhost:8080/api/wa/qr/wa-01
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "instanceId": "wa-01",
  "status": "connecting",
  "qr": "2@XXX...",
  "message": "Escanea el QR con WhatsApp"
}
```

**Pasos:**
1. Hacer el request en Postman
2. Copiar el valor del campo `qr`
3. Ir a https://www.qr-code-generator.com/ y pegar el código
4. Escanear el QR generado con tu WhatsApp (Dispositivos Vinculados)

**Nota:** También se muestra el QR en la consola del servidor.

---

### 2️⃣ **Verificar Estado de Conexión**

```
GET http://localhost:8080/api/wa/status/wa-01
```

**Respuesta:**
```json
{
  "success": true,
  "instanceId": "wa-01",
  "status": "connected"
}
```

**Estados posibles:**
- `disconnected` - No conectado
- `connecting` - Esperando escanear QR
- `connected` - ✅ Conectado y listo

---

### 3️⃣ **Enviar Mensaje de Texto**

```
POST http://localhost:8080/api/send
Content-Type: application/json
```

**Body:**
```json
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
  "message": "Mensaje text enviado a +51999999999",
  "instanceId": "wa-01",
  "type": "text"
}
```

---

### 4️⃣ **Enviar Imagen**

```
POST http://localhost:8080/api/send
Content-Type: application/json
```

**Body:**
```json
{
  "instanceId": "wa-01",
  "to": "+51999999999",
  "type": "image",
  "mediaUrl": "https://picsum.photos/400"
}
```

---

### 5️⃣ **Listar Instancias Activas**

```
GET http://localhost:8080/api/wa/instances
```

**Respuesta:**
```json
{
  "success": true,
  "instances": [
    {
      "instanceId": "wa-01",
      "status": "connected",
      "hasQR": false
    }
  ]
}
```

---

### 6️⃣ **Logout (Desconectar)**

```
POST http://localhost:8080/api/wa/logout/wa-01
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Instancia wa-01 desconectada"
}
```

---

## 🧪 Prueba del Hito 1 (Sesión Persistente)

### Test 1: Conexión QR

1. **Generar QR**: `GET /api/wa/qr/wa-01`
2. **Escanear** con WhatsApp
3. **Verificar estado**: `GET /api/wa/status/wa-01` → debe estar `connected`

### Test 2: Recepción de Mensajes

1. Desde tu teléfono, envía: **"hola"**
2. Recibirás automáticamente: **"✅ Eco: hola"**
3. Verifica en consola: `[wa-01] 📩 Mensaje de ...`

### Test 3: Envío de Mensajes

```json
POST /api/send
{
  "instanceId": "wa-01",
  "to": "+51999999999",
  "type": "text",
  "message": "Test desde gateway"
}
```

### Test 4: Persistencia (⭐ Clave para H1)

1. **Reinicia** el servidor: `docker-compose restart` o `Ctrl+C` y `npm run dev`
2. **Verifica estado**: `GET /api/wa/status/wa-01` → debe estar `connected`
3. **NO debe pedir QR nuevamente**
4. **Envía mensaje**: debe funcionar sin reescanear

---

## 📂 Estructura del Proyecto

```
whatsapp-ghl-gateway/
├── src/
│   ├── core/
│   │   └── baileys.ts          # Lógica de conexión WhatsApp
│   ├── api/
│   │   ├── qr.controller.ts    # Endpoints de QR y estado
│   │   └── send.controller.ts  # Endpoint de envío
│   └── index.ts                # Servidor Express
├── data/
│   └── sessions/               # Sesiones persistentes (QR no se vuelve a pedir)
├── docker-compose.yml
├── Dockerfile
├── .env
└── package.json
```

---

## 🔧 Variables de Entorno (`.env`)

```env
PORT=8080
SESSION_DIR=./data/sessions
TEXT_DELAY_MS=3500
MEDIA_DELAY_MS_MIN=6000
MEDIA_DELAY_MS_MAX=9000
```

---

## ✅ Criterios de Aceptación H1

| Criterio | Estado |
|----------|--------|
| ✅ Escaneo QR funcional | ✅ |
| ✅ Sesión persistente tras reinicio | ✅ |
| ✅ Recepción de mensajes | ✅ |
| ✅ Envío de texto | ✅ |
| ✅ Envío de imagen | ✅ |
| ✅ Rate limiting básico | ✅ |
| ✅ Logs estructurados | ✅ |

---

## 🐛 Troubleshooting

### Problema: "QR no disponible"
**Solución:** Espera 2-3 segundos y vuelve a hacer el request.

### Problema: "Instancia no está conectada"
**Solución:** Verifica el estado con `GET /api/wa/status/wa-01` y genera QR si es necesario.

### Problema: Sesión se pierde al reiniciar
**Solución:** Verifica que la carpeta `data/sessions/` tenga permisos de escritura.

---

## 📞 Formato de Números

Acepta múltiples formatos:
- `+51999999999`
- `51999999999`
- `999999999` (se agrega @s.whatsapp.net automáticamente)

---

## 🎯 Próximo Paso: Hito 2

- Colas con BullMQ + Redis
- Rate limiting avanzado
- Worker separado para envíos

---

## 📦 Colección Postman

Importa esta colección en Postman para probar todos los endpoints:

```json
{
  "info": {
    "name": "WhatsApp GHL Gateway H1",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Generar QR",
      "request": {
        "method": "GET",
        "url": "http://localhost:8080/api/wa/qr/wa-01"
      }
    },
    {
      "name": "2. Ver Estado",
      "request": {
        "method": "GET",
        "url": "http://localhost:8080/api/wa/status/wa-01"
      }
    },
    {
      "name": "3. Enviar Texto",
      "request": {
        "method": "POST",
        "url": "http://localhost:8080/api/send",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"instanceId\": \"wa-01\",\n  \"to\": \"+51999999999\",\n  \"type\": \"text\",\n  \"message\": \"Hola desde GHL\"\n}"
        }
      }
    },
    {
      "name": "4. Enviar Imagen",
      "request": {
        "method": "POST",
        "url": "http://localhost:8080/api/send",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"instanceId\": \"wa-01\",\n  \"to\": \"+51999999999\",\n  \"type\": \"image\",\n  \"mediaUrl\": \"https://picsum.photos/400\"\n}"
        }
      }
    },
    {
      "name": "5. Listar Instancias",
      "request": {
        "method": "GET",
        "url": "http://localhost:8080/api/wa/instances"
      }
    },
    {
      "name": "6. Logout",
      "request": {
        "method": "POST",
        "url": "http://localhost:8080/api/wa/logout/wa-01"
      }
    }
  ]
}
```

---

## 📝 Notas del Desarrollador

- **Baileys**: Librería no oficial, puede haber cambios en actualizaciones
- **Sesiones**: Se guardan en `data/sessions/[instanceId]/`
- **QR en terminal**: Útil para desarrollo local
- **Rate limiting**: Simple en memoria, en H2 se mejorará con Redis

---

**✅ Hito 1 completado** - Listo para probar en Postman 🚀
