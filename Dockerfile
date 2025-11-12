# Usamos la imagen oficial de Node.js 20 (como pide el doc [cite: 16])
FROM node:20-alpine

# Establecemos el directorio de trabajo
WORKDIR /app

# Copiamos package.json y package-lock.json
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Compilamos el TypeScript a JavaScript
RUN npm run build

# Exponemos el puerto
EXPOSE 8080

# El comando para iniciar la API
CMD ["npm", "start"]