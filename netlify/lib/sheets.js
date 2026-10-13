/**
 * Conexión con Google Sheets (servicio Cloud de almacenamiento).
 *
 * Se usa la API REST oficial de Google Sheets v4 autenticada con una
 * "cuenta de servicio" de Google Cloud. Las credenciales NUNCA van en el
 * código: se leen de variables de entorno configuradas en Netlify.
 *
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  correo de la cuenta de servicio
 *   GOOGLE_PRIVATE_KEY            llave privada de la cuenta de servicio
 *   GOOGLE_SHEET_ID               ID de la hoja (está en la URL de Sheets)
 *   SHEET_NAME                    nombre de la pestaña (por defecto "Productos")
 */
import crypto from 'node:crypto';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Columnas de la hoja, en orden (fila 1 = encabezados)
export const COLUMNAS = ['ID', 'Nombre', 'Precio', 'Categoria', 'Stock', 'FechaCreacion'];
const ULTIMA_COL = 'F';

let tokenCache = { token: null, expira: 0 };

function config() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const llave = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const hoja = process.env.SHEET_NAME || 'Productos';
  if (!email || !llave || !sheetId) {
    throw new Error(
      'Faltan variables de entorno de Google (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID)'
    );
  }
  return { email, llave, sheetId, hoja };
}

const base64url = (data) => Buffer.from(data).toString('base64url');

/** Obtiene un token de acceso OAuth2 firmando un JWT con la cuenta de servicio. */
async function obtenerToken() {
  if (tokenCache.token && Date.now() < tokenCache.expira) return tokenCache.token;

  const { email, llave } = config();
  const ahora = Math.floor(Date.now() / 1000);
  const encabezado = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const contenido = base64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600 })
  );
  const firma = crypto.createSign('RSA-SHA256').update(`${encabezado}.${contenido}`).sign(llave, 'base64url');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${encabezado}.${contenido}.${firma}`,
    }),
  });
  const datos = await res.json();
  if (!res.ok) throw new Error(`Error al autenticar con Google: ${datos.error_description || datos.error}`);

  tokenCache = { token: datos.access_token, expira: Date.now() + (datos.expires_in - 60) * 1000 };
  return tokenCache.token;
}

/** Hace una petición a la API de Google Sheets. */
async function sheetsFetch(ruta, opciones = {}) {
  const token = await obtenerToken();
  const res = await fetch(`${SHEETS_API}/${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) },
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Sheets respondió ${res.status}: ${datos.error?.message || 'error'}`);
  return datos;
}

const rango = (hoja, r) => encodeURIComponent(`'${hoja}'!${r}`);

/** Convierte una fila de la hoja en un objeto producto. */
function filaAProducto(fila) {
  return {
    id: Number(fila[0]),
    nombre: fila[1] ?? '',
    precio: Number(fila[2] ?? 0),
    categoria: fila[3] ?? '',
    stock: Number(fila[4] ?? 0),
    fechaCreacion: fila[5] ?? '',
  };
}

const productoAFila = (p) => [p.id, p.nombre, p.precio, p.categoria, p.stock, p.fechaCreacion];

/** Lee todas las filas (sin encabezado) junto con su número de fila en la hoja. */
async function leerFilas() {
  const { sheetId, hoja } = config();
  const datos = await sheetsFetch(`${sheetId}/values/${rango(hoja, `A2:${ULTIMA_COL}`)}`);
  return (datos.values || [])
    .map((fila, i) => ({ fila, numeroFila: i + 2 }))
    .filter(({ fila }) => fila[0] !== undefined && fila[0] !== '');
}

// ---------- Operaciones CRUD ----------

/** READ: devuelve todos los productos. */
export async function listarProductos() {
  const filas = await leerFilas();
  return filas.map(({ fila }) => filaAProducto(fila));
}

/** CREATE: agrega un producto al final de la hoja con un ID consecutivo. */
export async function crearProducto(datos) {
  const { sheetId, hoja } = config();
  const filas = await leerFilas();
  const maxId = filas.reduce((max, { fila }) => Math.max(max, Number(fila[0]) || 0), 0);
  const producto = { id: maxId + 1, ...datos, fechaCreacion: new Date().toISOString() };

  await sheetsFetch(
    `${sheetId}/values/${rango(hoja, `A:${ULTIMA_COL}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [productoAFila(producto)] }) }
  );
  return producto;
}

/** UPDATE: reemplaza los datos del producto con ese ID. Devuelve null si no existe. */
export async function actualizarProducto(id, datos) {
  const { sheetId, hoja } = config();
  const filas = await leerFilas();
  const encontrado = filas.find(({ fila }) => Number(fila[0]) === Number(id));
  if (!encontrado) return null;

  const anterior = filaAProducto(encontrado.fila);
  const producto = { ...anterior, ...datos, id: anterior.id, fechaCreacion: anterior.fechaCreacion };
  const r = `A${encontrado.numeroFila}:${ULTIMA_COL}${encontrado.numeroFila}`;

  await sheetsFetch(`${sheetId}/values/${rango(hoja, r)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [productoAFila(producto)] }),
  });
  return producto;
}

/** DELETE: elimina la fila del producto con ese ID. Devuelve false si no existe. */
export async function eliminarProducto(id) {
  const { sheetId, hoja } = config();
  const filas = await leerFilas();
  const encontrado = filas.find(({ fila }) => Number(fila[0]) === Number(id));
  if (!encontrado) return false;

  // Para borrar la fila completa se necesita el ID numérico de la pestaña
  const info = await sheetsFetch(`${sheetId}?fields=sheets.properties`);
  const pestana = info.sheets.find((s) => s.properties.title === hoja);
  if (!pestana) throw new Error(`No existe la pestaña "${hoja}" en la hoja de cálculo`);

  await sheetsFetch(`${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: pestana.properties.sheetId,
              dimension: 'ROWS',
              startIndex: encontrado.numeroFila - 1,
              endIndex: encontrado.numeroFila,
            },
          },
        },
      ],
    }),
  });
  return true;
}
