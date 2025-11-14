# Colección Postman - WhatsApp GHL Gateway H1

## Endpoints Principales

### 1. Health Check
```
GET http://localhost:8080/
```

### 2. Generar QR Code
```
GET http://localhost:8080/api/wa/qr/wa-01
```

### 3. Verificar Estado
```
GET http://localhost:8080/api/wa/status/wa-01
```

### 4. Enviar Texto
```
POST http://localhost:8080/api/send
Content-Type: application/json

{
  "instanceId": "wa-01",
  "to": "+51999999999",
  "type": "text",
  "message": "Hola desde GHL 🚀"
}
```

### 5. Enviar Imagen
```
POST http://localhost:8080/api/send
Content-Type: application/json

{
  "instanceId": "wa-01",
  "to": "+51999999999",
  "type": "image",
  "mediaUrl": "https://picsum.photos/400"
}
```

### 6. Listar Instancias
```
GET http://localhost:8080/api/wa/instances
```

### 7. Logout
```
POST http://localhost:8080/api/wa/logout/wa-01
```

## Flujo de Prueba Completo

1. **Conectar**: GET /api/wa/qr/wa-01 → Escanear QR
2. **Verificar**: GET /api/wa/status/wa-01 → status: "connected"
3. **Enviar texto**: POST /api/send (con type: "text")
4. **Enviar imagen**: POST /api/send (con type: "image")
5. **Reiniciar** servidor
6. **Verificar persistencia**: GET /api/wa/status/wa-01 → sin pedir QR
7. **Enviar mensaje**: debe funcionar sin reescanear
