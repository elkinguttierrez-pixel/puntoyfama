# Imagen base ligera de Node.js en Alpine Linux
FROM node:20-alpine

# Definir directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --no-audit --no-fund

# Copiar el código fuente de la aplicación
COPY . .

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Exponer el puerto
EXPOSE 3000

# Health check para orquestadores Docker / Cloud
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

# Comando de inicio del servidor
CMD ["node", "server.js"]
