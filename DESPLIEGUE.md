# 🌐 Guía Completa de Publicación y Despliegue — Punto y Fama

Esta guía te explica paso a paso cómo publicar **Punto y Fama** en internet para que cualquier persona pueda jugar desde su celular o PC desde cualquier lugar del mundo (con 4G, 5G o cualquier red Wi-Fi).

---

## 🚀 Opción 1: Publicar Gratis en Render.com (Recomendada)

**Render** ofrece hosting gratuito para aplicaciones Node.js con soporte completo para WebSockets y certificado SSL (HTTPS) automático.

### Pasos:
1. **Sube tu proyecto a GitHub:**
   - Si aún no tienes el código en GitHub, crea un repositorio nuevo en [github.com](https://github.com).
   - En tu terminal ejecuta:
     ```bash
     git init
     git add .
     git commit -m "Versión lista para producción"
     git branch -M main
     git remote add origin https://github.com/TU-USUARIO/punto-y-fama.git
     git push -u origin main
     ```

2. **Crea el servicio en Render:**
   - Entra a [render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
   - Haz clic en **"New +"** &rarr; **"Web Service"**.
   - Selecciona tu repositorio `punto-y-fama`.
   - Render detectará automáticamente el archivo [`render.yaml`](render.yaml) o puedes configurar:
     - **Runtime:** `Node`
     - **Build Command:** `npm install --omit=dev`
     - **Start Command:** `node server.js`
     - **Plan:** `Free`

3. **¡Listo!**
   - Render te asignará una URL pública segura como:  
     `https://punto-y-fama-xyz.onrender.com`
   - Al abrir esa URL en tu PC o Smart TV (`/host`), el **Código QR se adaptará automáticamente a tu dominio público**, permitiendo que todos los celulares se conecten escaneando el código desde cualquier parte del mundo.

---

## ⚡ Opción 2: Probar por Internet en 30 Segundos (Sin cuentas ni servidores)

Si solo quieres jugar hoy con amigos o familiares que están en otra casa sin tener que registrarte en ningún servicio cloud:

1. Inicia tu juego localmente:
   ```bash
   node server.js
   ```
2. En otra terminal, abre un túnel público seguro con `localtunnel` (incluido con npm):
   ```bash
   npx localtunnel --port 3000
   ```
3. Te dará una URL pública tipo:
   `https://rapid-tiger-55.loca.lt`
4. Abre esa URL en tu navegador (`/host`). El código QR detectará la URL pública y tus amigos podrán entrar inmediatamente desde cualquier lugar.

---

## 🚂 Opción 3: Publicar en Railway.app

**Railway** es otra plataforma excelente con despliegue instantáneo:

1. Entra a [railway.app](https://railway.app).
2. Haz clic en **"New Project"** &rarr; **"Deploy from GitHub repo"**.
3. Selecciona tu repositorio.
4. El archivo [`railway.json`](railway.json) ya configurado en el proyecto iniciará la aplicación automáticamente.
5. En la pestaña **Settings** de Railway, genera un dominio público (**Generate Domain**).

---

## 🐳 Opción 4: Contenedor Docker (VPS, Cloud Run, AWS o Servidor Propio)

El proyecto incluye un [`Dockerfile`](Dockerfile) optimizado multi-etapa con Alpine Linux.

### Construir y correr con Docker:
```bash
# Construir la imagen
docker build -t punto-y-fama .

# Ejecutar el contenedor en el puerto 3000
docker run -d -p 3000:3000 --name punto-y-fama-app punto-y-fama
```

---

## 🔑 Soporte de Múltiples Salas Privadas (Room Codes)

Al estar publicado en internet, diferentes grupos de personas pueden jugar simultáneamente sin cruzarse:
- **Sala Principal:** `https://tu-dominio.com/host` (jugadores en `/play`).
- **Salas Privadas:** Solo abre la sala con el parámetro `?room=CODIGO`:
  - Pantalla: `https://tu-dominio.com/host?room=FAMILIA`
  - Celulares: `https://tu-dominio.com/play?room=FAMILIA`
  - Puedes cambiar o crear salas en cualquier momento haciendo clic en el botón **"🔑 Cambiar Sala"** de la pantalla principal.
