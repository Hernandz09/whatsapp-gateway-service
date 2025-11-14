# 🎯 GUÍA RÁPIDA DE PRUEBA - HITO 1

## ⚡ Inicio en 3 pasos

### 1️⃣ Instalar y ejecutar

```powershell
cd \tmp\whatsapp-ghl-gateway
npm install
npm run dev
```

**Alternativa con script:**
```powershell
.\start.ps1
```

---

## 🧪 Pruebas en Postman

### PASO 1: Conectar WhatsApp (Generar QR)

**Request:**
```
GET http://localhost:8080/api/wa/qr/wa-01
```

**Resultado esperado:**
```json
{
  "success": true,
  "instanceId": "wa-01",
  "status": "connecting",
  "qr": "2@eyJ...",
  "message": "Escanea el QR con WhatsApp"
}
```

**Acción:**
1. Copia el valor del campo `qr`
2. Ve a: https://www.qr-code-generator.com/
3. Pega el código y genera el QR
4. En tu WhatsApp → Dispositivos Vinculados → Vincular dispositivo
5. Escanea el QR generado

**También puedes ver el QR en la consola del servidor** (se muestra automáticamente en ASCII)

---

### PASO 2: Verificar Conexión

**Request:**
```
GET http://localhost:8080/api/wa/status/wa-01
```

**Resultado esperado:**
```json
{
  "success": true,
  "instanceId": "wa-01",
  "status": "connected"
}
```

✅ Si dice `"connected"`, ¡listo para enviar mensajes!

---

### PASO 3: Probar Recepción (Auto-respuesta)

**Acción manual:**
1. Desde tu teléfono, envía al número conectado: **hola**
2. Recibirás automáticamente: **✅ Eco: hola**

**En la consola verás:**
```
[wa-01] 📩 Mensaje de 51999999999@s.whatsapp.net: hola
[wa-01] 📤 Respuesta automática enviada a 51999999999@s.whatsapp.net
```

---

### PASO 4: Enviar Texto desde API

**Request:**
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
  "message": "Hola desde el gateway GHL 🚀"
}
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Mensaje text enviado a +51999999999",
  "instanceId": "wa-01",
  "type": "text"
}
```

✅ Verifica que llegó el mensaje a tu WhatsApp

---

### PASO 5: Enviar Imagen

**Request:**
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

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Mensaje image enviado a +51999999999",
  "instanceId": "wa-01",
  "type": "image"
}
```

✅ Verifica que llegó la imagen a tu WhatsApp

**En consola:**
```
[wa-01] ⏱️  Esperando 6000ms (rate-limit)
[wa-01] 📤 IMAGEN enviada a 51999999999
```

---

### PASO 6: Probar Rate Limiting

**Envía 3 mensajes seguidos:**

```json
POST /api/send
{"instanceId":"wa-01","to":"+51999999999","type":"text","message":"Mensaje 1"}

POST /api/send
{"instanceId":"wa-01","to":"+51999999999","type":"text","message":"Mensaje 2"}

POST /api/send
{"instanceId":"wa-01","to":"+51999999999","type":"text","message":"Mensaje 3"}
```

**Resultado esperado:**
- Los mensajes se envían con ~3.5 segundos de separación
- En consola verás: `[wa-01] ⏱️  Esperando XXXXms (rate-limit)`

---

### PASO 7: 🌟 PRUEBA CLAVE - PERSISTENCIA DE SESIÓN

**Objetivo:** Verificar que NO se pida QR después de reiniciar

**Pasos:**

1. **Detener el servidor**: `Ctrl + C` en la terminal

2. **Reiniciar**: `npm run dev`

3. **Verificar estado SIN pedir QR:**
   ```
   GET http://localhost:8080/api/wa/status/wa-01
   ```

   **Debe responder:**
   ```json
   {
     "success": true,
     "instanceId": "wa-01",
     "status": "connected"
   }
   ```

4. **Enviar mensaje de prueba:**
   ```json
   POST /api/send
   {
     "instanceId": "wa-01",
     "to": "+51999999999",
     "type": "text",
     "message": "Prueba después de reinicio ✅"
   }
   ```

5. **✅ SI FUNCIONA SIN PEDIR QR = HITO 1 COMPLETADO**

---

## 📊 Checklist de Validación H1

| Prueba | Estado | Nota |
|--------|--------|------|
| ✅ Generar QR | ⬜ | GET /api/wa/qr/wa-01 |
| ✅ Escanear y conectar | ⬜ | Desde WhatsApp |
| ✅ Recibir "hola" → "Eco: hola" | ⬜ | Auto-respuesta |
| ✅ Enviar texto desde API | ⬜ | POST /api/send type: text |
| ✅ Enviar imagen desde API | ⬜ | POST /api/send type: image |
| ✅ Rate limiting funciona | ⬜ | Delays de 3-4s / 6-9s |
| ✅ **Persistencia tras reinicio** | ⬜ | **SIN pedir QR** |

---

## 🐛 Errores Comunes

### Error: "QR no disponible"
**Causa:** El QR tarda unos segundos en generarse  
**Solución:** Espera 2-3 segundos y vuelve a hacer GET /api/wa/qr/wa-01

### Error: "Instancia no está conectada"
**Causa:** No has escaneado el QR o se desconectó  
**Solución:** Verifica estado con GET /api/wa/status/wa-01

### Error: Sesión se pierde al reiniciar
**Causa:** Carpeta data/sessions no tiene permisos  
**Solución:** 
```powershell
New-Item -ItemType Directory -Force -Path ".\data\sessions"
```

---

## 📁 Archivos Importantes

- **Sesiones persistentes**: `data/sessions/wa-01/`
- **Logs**: Consola del servidor
- **Config**: `.env`

---

## 🎬 Flujo Completo de Prueba (5 minutos)

1. ✅ `npm run dev`
2. ✅ GET /api/wa/qr/wa-01 → Escanear QR
3. ✅ GET /api/wa/status/wa-01 → Verificar "connected"
4. ✅ Enviar "hola" desde teléfono → Recibir "Eco: hola"
5. ✅ POST /api/send (texto) → Verificar llegada
6. ✅ POST /api/send (imagen) → Verificar llegada
7. ✅ Ctrl+C → npm run dev → GET /api/wa/status/wa-01 → **SIN QR**
8. ✅ POST /api/send → Funciona sin reescanear

---

## 🎯 Resultado Esperado

Al completar todas las pruebas:

✅ **WhatsApp conectado mediante QR**  
✅ **Sesión persistente (no pide QR tras reinicio)**  
✅ **Recepción de mensajes funcionando**  
✅ **Envío de texto y media funcionando**  
✅ **Rate limiting aplicado**  
✅ **Logs estructurados visibles**

---

## 📞 Números de Prueba

Formato aceptado:
- `+51999999999`
- `51999999999`
- `999999999@s.whatsapp.net`

---

## 🚀 Próximos Pasos (Hito 2)

- Implementar BullMQ + Redis para colas
- Worker separado para envíos
- Rate limiting avanzado
- Reintentos automáticos

---

**¿Listo para probar? ¡Adelante! 🎉**
