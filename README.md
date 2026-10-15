# 🎯 Punto y Fama | Edición Multijugador en Vivo & Móvil

Una aplicación web moderna, interactiva y en tiempo real del tradicional juego de lógica y deducción **Punto y Fama** (también conocido mundialmente como *Bulls and Cows* o *Picas y Fijas*).

Diseñada con soporte para **múltiples jugadores simultáneos desde sus teléfonos celulares**, **pantalla central de TV/Proyector (Host)** con código QR automático, tablero de posiciones en vivo y privacidad estricta en pantalla pública.

---

## 📱 Modo Multijugador en Vivo (Celulares + Pantalla TV)

### 👑 Reglas de Puntuación Oficiales
- **1 Fama = +25 Puntos:** Dígito y posición coinciden de forma exacta.
- **1 Punto = +1 Punto:** Dígito presente en el código secreto pero en otra posición.
- **4 Famas = ¡Victoria de Ronda!** El primer jugador en descifrar las 4 cifras exactas gana la ronda (+100 puntos) y revela el código secreto para toda la sala.

### 🔒 Privacidad Estricta en Pantalla Pública
- En la pantalla compartida (Host / TV / Proyector) **solo aparece si el intento obtuvo Puntos o Famas** (ejemplo: `👑 2 Famas | ⚡ 1 Punto (+51 pts)`).
- **Nunca se muestran las 4 cifras ingresadas en la pantalla pública**, para evitar que los demás rivales espíen o copien las cifras deducidas.
- En el celular de cada jugador, cada uno ve su historial personal con sus 4 cifras ingresadas y su propio desglose para continuar deduciendo.

---

## 🚀 Arquitectura y Componentes del Sistema

```
punto-y-fama/
├── host.html               # Pantalla Central (TV / PC / Proyector) con Podio, Feed en vivo y QR
├── play.html               # Interfaz móvil para celulares con teclado táctil optimizado para pulgar
├── index.html              # Interfaz clásica individual, duelo local y lanzador a Sala TV
├── css/
│   └── styles.css          # Efectos neón, badges glow, animaciones y glassmorphism
├── js/
│   ├── gameLogic.js        # Motor de lógica estricta (UMD: Node.js + Navegador)
│   ├── host.js             # Controlador WebSocket para la Pantalla Central
│   ├── play.js             # Controlador WebSocket para Celulares con háptica y teclado
│   ├── soundEffects.js     # Sintetizador de audio nativo con Web Audio API
│   ├── userManager.js      # Perfiles locales y estadísticas persistentes
│   └── app.js              # Controlador principal del modo solitario y duelo local
├── test/
│   ├── gameLogic.test.js   # Pruebas unitarias de cálculo de Famas y Puntos
│   ├── userManager.test.js # Pruebas del gestor de usuarios
│   ├── multiplayer.test.js # Pruebas de reglas de puntuación (Fama=25, Punto=1) y privacidad
│   └── e2e_multiplayer.test.js # Prueba E2E WebSocket en tiempo real (Host + 2 Celulares)
├── server.js               # Servidor HTTP + WebSockets con detección de IP local y QR
└── package.json            # Scripts de ejecución y dependencias
```

---

## 🛠️ Cómo Iniciar la Partida Multijugador

### 1. Iniciar el Servidor Local
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
npm start
# o directamente:
node server.js
```

El servidor detectará automáticamente la dirección IP local de tu red Wi-Fi e imprimirá en consola:
```
======================================================
🎯 PUNTO Y FAMA — MULTIJUGADOR EN VIVO (HOST + CELULARES)
======================================================
🖥️  Pantalla Principal (Host / TV): http://localhost:3000/host
📲  Acceso desde Celulares:        http://192.168.X.X:3000/play
🌐  Red Local IP:                  192.168.X.X
⚙️  Reglas de Puntaje:             1 Fama = 25 pts | 1 Punto = 1 pt
🔒  Privacidad en Pantalla:        Solo resultados Fama/Punto (Sin dígitos)
======================================================
```

### 2. Abrir la Pantalla Central (Host / TV)
- En tu PC o Smart TV conectada a la misma red, abre:
  `http://localhost:3000/host` (o desde `http://localhost:3000/` pulsa en **"📺 Sala TV / Celulares"**).
- Verás el **Código QR gigante**, el Podio de líderes y el Feed de intentos en vivo.

### 3. Conectar los Celulares
- Todos los jugadores en la misma red Wi-Fi escanean el código QR con la cámara de sus teléfonos (o ingresan a la URL `http://192.168.X.X:3000/play`).
- Eligen su avatar (`👑`, `⚡`, `🚀`, `🎯`, `🦊`, `🦁`, `🔥`, `💎`, `🦄`, `👾`), escriben su nombre y entran a la sala.
- Cada jugador ingresa números de 4 cifras con el teclado táctil ergonómico.

---

## 🌐 Publicar en Internet (Jugar fuera de casa)

El proyecto está 100% optimizado para la nube (Render, Railway, Fly.io, Docker o ngrok). Consulta la guía completa:
👉 **[DESPLIEGUE.md](DESPLIEGUE.md)**

### Características de Producción:
- **Detección Dinámica de Dominio:** El QR se adapta automáticamente a cualquier dominio público o túnel.
- **WebSocket Heartbeat:** Mantiene las conexiones activas en servidores cloud sin desconexiones por inactividad.
- **Salas Múltiples:** Diferentes grupos pueden jugar simultáneamente con URLs privadas (ejemplo: `/host?room=FAMILIA`).

---

## 🧪 Pruebas Automatizadas

Para ejecutar todas las pruebas unitarias, de integración E2E y de salas:
```bash
node test/runAll.js
```
O de manera individual:
```bash
node test/gameLogic.test.js
node test/userManager.test.js
node test/multiplayer.test.js
node test/e2e_multiplayer.test.js
node test/rooms.test.js
```
Todas las pruebas están verificadas y pasan al 100%.
