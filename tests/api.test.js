/**
 * Pruebas automáticas de la API REST.
 * Se simula Google Sheets en memoria (no se necesita internet ni credenciales).
 * Ejecutar con:  npm test
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ---- Variables de entorno de prueba (llave RSA generada al momento) ----
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'prueba@proyecto.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
process.env.GOOGLE_SHEET_ID = 'HOJA_PRUEBA';
process.env.SHEET_NAME = 'Productos';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = '12345';

// ---- Google Sheets simulado ----
const hoja = [['ID', 'Nombre', 'Precio', 'Categoria', 'Stock', 'FechaCreacion']];
global.fetch = async (url, opciones = {}) => {
  const json = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo });
  const u = decodeURIComponent(url);

  if (u.startsWith('https://oauth2.googleapis.com/token')) {
    const assertion = new URLSearchParams(opciones.body).get('assertion');
    assert.equal(assertion.split('.').length, 3, 'el JWT debe tener 3 partes');
    return json(200, { access_token: 'token-falso', expires_in: 3600 });
  }
  assert.equal(opciones.headers.Authorization, 'Bearer token-falso');

  if (u.endsWith("values/'Productos'!A2:F")) return json(200, { values: hoja.slice(1).map((f) => f.map(String)) });
  if (u.includes(':append')) {
    hoja.push(JSON.parse(opciones.body).values[0]);
    return json(200, {});
  }
  const mUpdate = u.match(/values\/'Productos'!A(\d+):F\d+/);
  if (mUpdate && opciones.method === 'PUT') {
    hoja[Number(mUpdate[1]) - 1] = JSON.parse(opciones.body).values[0];
    return json(200, {});
  }
  if (u.includes('fields=sheets.properties')) return json(200, { sheets: [{ properties: { title: 'Productos', sheetId: 0 } }] });
  if (u.includes(':batchUpdate')) {
    const { startIndex, endIndex } = JSON.parse(opciones.body).requests[0].deleteDimension.range;
    hoja.splice(startIndex, endIndex - startIndex);
    return json(200, {});
  }
  return json(404, { error: { message: `ruta simulada desconocida ${u}` } });
};

let productos, login, token;
before(async () => {
  ({ handler: productos } = await import('../netlify/functions/productos.js'));
  ({ handler: login } = await import('../netlify/functions/login.js'));
});

const evento = (httpMethod, path, body, conToken = true) => ({
  httpMethod,
  path,
  headers: conToken && token ? { authorization: `Bearer ${token}` } : {},
  body: body ? JSON.stringify(body) : null,
});
const llamar = async (fn, ev) => {
  const r = await fn(ev);
  return { status: r.statusCode, cuerpo: JSON.parse(r.body) };
};

test('Prueba 2: login incorrecto es rechazado', async () => {
  const r = await llamar(login, evento('POST', '/api/login', { usuario: 'admin', contrasena: 'mala' }));
  assert.equal(r.status, 401);
});

test('Prueba 1: login correcto devuelve token', async () => {
  const r = await llamar(login, evento('POST', '/api/login', { usuario: 'admin', contrasena: '12345' }));
  assert.equal(r.status, 200);
  assert.ok(r.cuerpo.token);
  token = r.cuerpo.token;
});

test('Crear sin sesión es rechazado', async () => {
  const r = await llamar(productos, evento('POST', '/api/productos', { nombre: 'X', precio: 1, categoria: 'A', stock: 1 }, false));
  assert.equal(r.status, 401);
});

test('Validación: registro incompleto es rechazado', async () => {
  const r = await llamar(productos, evento('POST', '/api/productos', { nombre: '', precio: -5, categoria: '', stock: 1.5 }));
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.errores.length, 4);
});

test('Prueba 3: CREATE guarda en Sheets con ID consecutivo', async () => {
  const a = await llamar(productos, evento('POST', '/api/productos', { nombre: 'Laptop', precio: 15000, categoria: 'Computación', stock: 10 }));
  const b = await llamar(productos, evento('POST', '/.netlify/functions/productos', { nombre: 'Mouse', precio: 350, categoria: 'Accesorios', stock: 25 }));
  assert.equal(a.status, 201);
  assert.equal(a.cuerpo.producto.id, 1);
  assert.equal(b.cuerpo.producto.id, 2);
  assert.equal(hoja.length, 3);
});

test('Prueba 4: READ lista desde Sheets', async () => {
  const r = await llamar(productos, evento('GET', '/api/productos'));
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.origen, 'Google Sheets');
  assert.equal(r.cuerpo.total, 2);
  assert.deepEqual(r.cuerpo.productos.map((p) => p.nombre), ['Laptop', 'Mouse']);
  assert.equal(typeof r.cuerpo.productos[0].precio, 'number');
});

test('Prueba 5: UPDATE modifica la fila correcta', async () => {
  const r = await llamar(productos, evento('PUT', '/api/productos/1', { nombre: 'Laptop', precio: 14500, categoria: 'Computación', stock: 10 }));
  assert.equal(r.status, 200);
  assert.equal(hoja[1][2], 14500);
  assert.equal(hoja[2][1], 'Mouse');
  const noExiste = await llamar(productos, evento('PUT', '/api/productos/99', { nombre: 'Nada', precio: 1, categoria: 'A', stock: 0 }));
  assert.equal(noExiste.status, 404);
});

test('Prueba 6: DELETE elimina la fila de Sheets', async () => {
  const r = await llamar(productos, evento('DELETE', '/.netlify/functions/productos/1'));
  assert.equal(r.status, 200);
  assert.equal(hoja.length, 2);
  assert.equal(hoja[1][1], 'Mouse');
  const lista = await llamar(productos, evento('GET', '/api/productos'));
  assert.equal(lista.cuerpo.total, 1);
});

test('Después de borrar, el siguiente ID no se repite con uno existente', async () => {
  const r = await llamar(productos, evento('POST', '/api/productos', { nombre: 'Teclado', precio: 899.5, categoria: 'Accesorios', stock: 3 }));
  assert.equal(r.cuerpo.producto.id, 3);
});
