# 🚀 Proyecto: Gateway WhatsApp ↔ GHL

Este proyecto es un gateway de backend para conectar WhatsApp (mediante escaneo QR) con sistemas externos, en este caso, GHL.

## 🎯 Hito 1: Conexión QR y Sesión Persistente (¡Completado!)

El estado actual de esta rama (`feature/h1-willians`) contiene la implementación completa del Hito 1. El sistema es capaz de:

- Iniciar una conexión con WhatsApp y generar un código QR.
- Permitir que un usuario escanee el QR y se conecte.
- Procesar mensajes entrantes (mediante una prueba de "eco").
- **Persistir la sesión**: El sistema puede reiniciarse (`docker-compose restart`) y la sesión se mantiene activa sin necesidad de volver a escanear.

---

## 🛠️ Stack Tecnológico (H1)

- [cite_start]**Node.js (v20+)** [cite: 3]
- [cite_start]**TypeScript** [cite: 18]
- [cite_start]**Docker** y **Docker Compose** [cite: 6]
- [cite_start]**Redis** (para la futura gestión de colas) [cite: 11]
- [cite_start]**Baileys** (`@whiskeysockets/baileys`) [cite: 38]
- [cite_start]**Express.js** (para la API) [cite: 39]

---

## 🚀 Guía de Instalación y Prueba (Desde Cero)

Sigue estos pasos para clonar el repositorio y ejecutar el Hito 1.

### 1. Prerrequisitos

Asegúrate de tener **Node.js (v20+)** y **Docker Desktop** instalados y en funcionamiento en tu máquina.

### 2. Clonar y Configurar el Entorno

1.  Clona el repositorio y entra en la carpeta:

    ```sh
    git clone <URL-DEL-REPOSITORIO>
    cd <NOMBRE-DE-LA-CARPETA>
    ```

2.  Instala las dependencias de Node.js (esto es **vital** para que Docker pueda construir la imagen):

    ```sh
    npm install
    ```

3.  Crea tu archivo de variables de entorno. Copia el archivo `.env.example` y renómbralo a `.env`.

    ```sh
    # En Windows (PowerShell)
    copy .env.example .env

    # En Mac/Linux
    cp .env.example .env
    ```

    **Nota:** El archivo `.env` ya está configurado con los valores por defecto para Docker. No necesitas modificarlo.

### 3. Levantar los Contenedores

Usa Docker Compose para construir y levantar todos los servicios (API, Worker y Redis).

```sh
# La primera vez, usa --build para construir la imagen
docker-compose up --build
```

La API estará corriendo en http://localhost:8080.

4. Probar la Funcionalidad (H1)
   Sigue la secuencia de pruebas oficial del sprint :

a. Generar el QR: Abre en tu navegador la URL: http://localhost:8080/api/wa/qr/wa-01

b. Escanear: En la terminal donde corriste docker-compose, verás un código QR impreso. Escanéalo con tu teléfono WhatsApp (en "Dispositivos Vinculados").

c. Probar el "Eco" (Conexión): Espera a que la terminal muestre [wa-01] Connection OPEN. Envía un mensaje que diga "hola" a tu propio número (o desde otro teléfono). Deberías recibir la respuesta "eco: hola".

d. Probar la Persistencia (La prueba final): Detén los contenedores (presionando Ctrl + C en la terminal).

Vuelve a levantarlos: docker-compose up (esta vez no necesitas --build).

Espera a que la terminal muestre [wa-01] Connection OPEN (esta vez debe hacerlo automáticamente). Envía "hola" de nuevo.

Si recibes el segundo "eco", el Hito 1 está 100% verificado.
