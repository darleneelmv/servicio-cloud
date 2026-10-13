# ☁️ Sistema Cloud — Inventario de productos

Aplicación web CRUD con login que integra varios servicios Cloud:

| Componente     | Tecnología                                   |
|----------------|----------------------------------------------|
| Interfaz       | React 18 + Vite                              |
| API            | Node.js + API REST (Netlify Functions)       |
| Base de datos  | Google Sheets (API de Google Sheets v4)      |
| Repositorio    | GitHub                                       |
| Despliegue     | Netlify                                      |
| Comunicación   | HTTP / Fetch (JSON)                          |

## Arquitectura

```
 USUARIO ──► React (frontend/) ──HTTP/Fetch──► API REST Node.js (netlify/functions/) ──API──► Google Sheets
                    Código fuente → GitHub          Despliegue → Netlify
```

## Funcionalidades

- **Login** con validación (usuario y contraseña en variables de entorno; por defecto `admin` / `12345`).
- **CREATE** – agregar productos (nombre, precio, categoría, stock).
- **READ** – la tabla se llena automáticamente desde Google Sheets.
- **UPDATE** – editar en una ventana modal.
- **DELETE** – eliminar con confirmación.
- **Adicionales:** búsqueda por nombre, filtro por categoría, ordenamiento (nombre, precio, stock, fecha),
  validación de formularios (en React y en la API), contadores (total de registros, unidades, valor del
  inventario, stock bajo), mensajes de éxito/error, fecha de creación, modo oscuro y diseño responsivo.

## Estructura del proyecto

```
sistema-cloud/
├── frontend/                  ← Interfaz React
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            ← controla login / sistema
│       ├── api.js             ← llamadas fetch a la API REST
│       ├── styles.css
│       └── components/
│           ├── Login.jsx
│           ├── Sistema.jsx    ← pantalla principal (tabla, búsqueda, filtros, contadores)
│           ├── ProductoForm.jsx
│           └── Modal.jsx
├── netlify/
│   ├── functions/             ← API REST (Node.js)
│   │   ├── login.js
│   │   └── productos.js
│   └── lib/
│       ├── sheets.js          ← conexión con Google Sheets
│       └── http.js            ← respuestas, sesión y validación
├── tests/api.test.js          ← pruebas automáticas de la API
├── netlify.toml               ← configuración de build, funciones y rutas /api
├── package.json
├── .env.example               ← plantilla de variables (sin datos reales)
└── README.md
```

## API REST

| Método | Ruta                  | Acción                      |
|--------|-----------------------|-----------------------------|
| POST   | `/api/login`          | Iniciar sesión              |
| GET    | `/api/productos`      | Consultar todos             |
| GET    | `/api/productos/:id`  | Consultar uno               |
| POST   | `/api/productos`      | Crear                       |
| PUT    | `/api/productos/:id`  | Actualizar                  |
| DELETE | `/api/productos/:id`  | Eliminar                    |

`/api/*` es un alias de `/.netlify/functions/*` (configurado en `netlify.toml`), así que
también funcionan `/.netlify/functions/productos` y `/.netlify/functions/productos/:id`.
Crear, actualizar y eliminar requieren el token que entrega el login.

---

# 🚀 Guía de instalación y despliegue (paso a paso)

### Paso 1 · Crear la hoja de Google Sheets

1. Entra a <https://sheets.google.com> y crea una hoja nueva llamada `Sistema Cloud`.
2. Cambia el nombre de la pestaña de abajo (Hoja 1) a **`Productos`**.
3. En la fila 1 escribe estos encabezados, uno por columna (A a F):

   | A  | B      | C      | D         | E     | F             |
   |----|--------|--------|-----------|-------|---------------|
   | ID | Nombre | Precio | Categoria | Stock | FechaCreacion |

4. Copia el **ID de la hoja** desde la URL: es el texto entre `/d/` y `/edit`.
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit`

### Paso 2 · Crear la cuenta de servicio en Google Cloud

1. Entra a <https://console.cloud.google.com> con tu cuenta de Google y crea un proyecto nuevo
   (por ejemplo `sistema-cloud`).
2. Ve a **APIs y servicios → Biblioteca**, busca **Google Sheets API** y presiona **Habilitar**.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
   Ponle un nombre (`sistema-cloud-api`) y termina el asistente (no necesita roles).
4. Abre la cuenta de servicio creada → pestaña **Claves** → **Agregar clave → Crear clave nueva → JSON**.
   Se descarga un archivo `.json`. **No lo subas a GitHub.**
5. De ese archivo necesitarás dos valores: `client_email` y `private_key`.

### Paso 3 · Compartir la hoja con la cuenta de servicio

En tu hoja de Google Sheets presiona **Compartir**, pega el `client_email`
(termina en `iam.gserviceaccount.com`) y dale permiso de **Editor**.

### Paso 4 · Subir el código a GitHub

1. Crea un repositorio nuevo en <https://github.com/new> (por ejemplo `sistema-cloud`).
2. Desde la carpeta del proyecto:

   ```bash
   git init
   git add .
   git commit -m "Sistema Cloud: React + API REST + Google Sheets"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/sistema-cloud.git
   git push -u origin main
   ```

   (También puedes usar **Add file → Upload files** en la página del repositorio y arrastrar
   el contenido de la carpeta). Verifica que **no** se haya subido ningún `.env` ni el `.json` de Google.

### Paso 5 · Desplegar en Netlify

1. Entra a <https://app.netlify.com> → **Add new site → Import an existing project → GitHub**
   y elige tu repositorio.
2. Netlify lee `netlify.toml` y llena solo la configuración:
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
   - Functions directory: `netlify/functions`
3. Antes de desplegar (o después en **Site configuration → Environment variables**) agrega:

   | Variable                       | Valor                                                    |
   |--------------------------------|----------------------------------------------------------|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | el `client_email` del JSON                               |
   | `GOOGLE_PRIVATE_KEY`           | el `private_key` del JSON completo, desde `-----BEGIN` hasta `END PRIVATE KEY-----` |
   | `GOOGLE_SHEET_ID`              | el ID de tu hoja (Paso 1)                                |
   | `SHEET_NAME`                   | `Productos`                                              |
   | `ADMIN_USER`                   | `admin` (o el que quieras)                               |
   | `ADMIN_PASSWORD`               | `12345` (o la que quieras)                               |
   | `SESSION_SECRET`               | cualquier frase larga inventada                          |

4. Presiona **Deploy**. Si agregaste las variables después, ve a **Deploys → Trigger deploy →
   Deploy site** para que las tome.
5. Opcional: en **Site configuration → Change site name** pon un nombre como `mi-sistema-cloud`
   para que la URL sea `https://mi-sistema-cloud.netlify.app`.

### Paso 6 · Comprobar

- Abre `https://TU-SITIO.netlify.app/api/productos` → debe mostrar un JSON con
  `"origen": "Google Sheets"` (evidencia de **API funcionando**).
- Abre `https://TU-SITIO.netlify.app`, inicia sesión y prueba el CRUD; los cambios aparecen
  en la hoja de Google Sheets al instante.

---

## 🧪 Pruebas y capturas para el reporte

| # | Prueba / evidencia                    | Qué hacer y capturar                                                         |
|---|---------------------------------------|------------------------------------------------------------------------------|
| 1 | Login correcto                        | Pantalla de login con datos, y luego el sistema abierto                       |
| 2 | Login incorrecto                      | Contraseña errónea → mensaje "Usuario o contraseña incorrectos"              |
| 3 | CREATE                                | Formulario lleno + mensaje verde + registro nuevo en la tabla                |
| 4 | READ                                  | Tabla con registros y la leyenda "Origen: Google Sheets"                      |
| 5 | UPDATE                                | Modal de edición con el precio nuevo, y la tabla ya actualizada              |
| 6 | DELETE                                | Ventana "¿Deseas eliminar este registro?" y la tabla sin el registro         |
| 7 | Funcionalidad adicional               | Búsqueda por nombre, filtro por categoría, ordenamiento y contadores          |
| 8 | Cambios en Google Sheets              | La hoja mostrando los datos después de crear, editar y eliminar              |
| – | Repositorio GitHub                    | Página del repositorio con los archivos                                      |
| – | Netlify                               | Panel de Netlify con el deploy "Published" y la URL                          |
| – | Estructura del proyecto               | Árbol de carpetas en VS Code o en GitHub                                     |
| – | API funcionando                       | `/api/productos` abierto en el navegador mostrando el JSON                   |

> ⚠️ Al capturar el panel de variables de entorno de Netlify, **oculta los valores**. No muestres
> la llave privada ni el contenido del JSON de Google en el PDF.

## 💻 Ejecutar en tu computadora (opcional)

```bash
npm install
npm install -g netlify-cli
cp .env.example .env     # y llénalo con tus datos reales
netlify dev              # abre http://localhost:8888
npm test                 # pruebas automáticas de la API (Sheets simulado)
```

## 🛠️ Solución de problemas

| Mensaje                                              | Causa y solución                                                        |
|------------------------------------------------------|-------------------------------------------------------------------------|
| `Faltan variables de entorno de Google`              | Falta alguna variable en Netlify, o no se volvió a desplegar después de agregarla |
| `Google Sheets respondió 403`                        | La hoja no está compartida como Editor con el `client_email`            |
| `Google Sheets respondió 400 … Unable to parse range`| La pestaña no se llama `Productos` (o cambia `SHEET_NAME`)              |
| `Error al autenticar con Google: invalid_grant`      | La `GOOGLE_PRIVATE_KEY` está incompleta; pégala completa con BEGIN/END |
| `Google Sheets API has not been used in project…`    | No se habilitó Google Sheets API (Paso 2.2)                             |
| La página carga pero la tabla dice error             | Abre `/api/productos` para ver el mensaje exacto de la API              |
