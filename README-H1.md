Proyecto: Gateway WhatsApp ↔ GHL
Este proyecto es un gateway de backend para conectar WhatsApp (mediante escaneo QR) con GHL.

Hito 1: Conexión QR y Sesión Persistente
El objetivo de este hito (H1) está COMPLETADO. El sistema actual es capaz de:

Iniciar una conexión con WhatsApp y generar un código QR.

Permitir que un usuario escanee el QR y se conecte.

Procesar mensajes entrantes (Prueba de "eco").

Persistir la sesión, permitiendo reiniciar el servidor sin necesidad de volver a escanear.

🛠️ Stack Tecnológico

Node.js (v20+)

TypeScript

Docker y Docker Compose

Redis

Baileys (@whiskeysockets/baileys)

Express.js

📋 Prerrequisitos
Asegúrate de tener instalado lo siguiente en tu máquina local:

Node.js v20+: Verificar con node -v

Docker Desktop: Verificar con docker -v y docker compose version

Git: Verificar con git --version

⚙️ Configuración
Clona el repositorio.

Crea un archivo .env en la raíz del proyecto.

Copia y pega el siguiente contenido (basado en el plan del sprint ):

Ini, TOML

PORT=8080
REDIS_URL=redis://redis:6379
SESSION_DIR=/data/sessions
🚀 Ejecución (con Docker)
Instala las dependencias de Node.js (esto es necesario para que el docker-compose build funcione correctamente):

Bash

npm install
Levanta todos los servicios (API, Worker y Redis) usando Docker Compose. El comando --build es importante la primera vez o si haces cambios en el código:

Bash

docker-compose up --build
La API estará corriendo en http://localhost:8080.

🧪 Prueba del Hito 1
Para validar que el H1 está completo, sigue estos pasos :

Generar QR: Con los contenedores corriendo, abre en tu navegador: http://localhost:8080/api/wa/qr/wa-01

Escanear: Verás un código QR impreso en la terminal de Docker. Escanéalo con tu teléfono WhatsApp (en "Dispositivos Vinculados").

Probar Conexión (Eco):

Una vez que la terminal muestre [wa-01] Connection OPEN, envía un mensaje que diga "hola" a tu propio número.

Deberías recibir una respuesta automática: "eco: hola".

Probar Persistencia (¡La prueba clave!):

Detén los contenedores (presionando Ctrl + C en la terminal).

Vuelve a levantarlos (esta vez sin build): docker-compose up

Sin escanear de nuevo, espera a que la terminal muestre [wa-01] Connection OPEN.

Envía "hola" a tu propio número otra vez.

Si recibes el segundo "eco", ¡el Hito 1 está completo y la sesión es persistente!
