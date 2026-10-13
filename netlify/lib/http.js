/**
 * Utilidades compartidas por las funciones de la API:
 * respuestas JSON, sesión sencilla y validación de datos.
 */
import crypto from 'node:crypto';

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: HEADERS,
  body: JSON.stringify(cuerpo),
});

// ---------- Sesión sencilla ----------
// El usuario y la contraseña se leen de variables de entorno. Si no se
// configuran, se usan los valores de ejemplo de la práctica (admin / 12345).
export const credenciales = () => ({
  usuario: process.env.ADMIN_USER || 'admin',
  contrasena: process.env.ADMIN_PASSWORD || '12345',
});

const secreto = () => process.env.SESSION_SECRET || `sistema-cloud:${credenciales().contrasena}`;

/** Genera un token de sesión firmado (HMAC) para el usuario. */
export const crearToken = (usuario) =>
  `${Buffer.from(usuario).toString('base64url')}.${crypto
    .createHmac('sha256', secreto())
    .update(usuario)
    .digest('base64url')}`;

/** Comprueba el encabezado "Authorization: Bearer <token>". */
export function sesionValida(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const [usuarioB64] = token.split('.');
  if (!usuarioB64) return false;
  const usuario = Buffer.from(usuarioB64, 'base64url').toString();
  const esperado = crearToken(usuario);
  return (
    usuario === credenciales().usuario &&
    token.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado))
  );
}

// ---------- Validación (evita registros incompletos o incorrectos) ----------
export function validarProducto(datos) {
  const errores = [];
  const nombre = String(datos?.nombre ?? '').trim();
  const categoria = String(datos?.categoria ?? '').trim();
  const precio = Number(datos?.precio);
  const stock = Number(datos?.stock);

  if (nombre.length < 2) errores.push('El nombre debe tener al menos 2 caracteres');
  if (nombre.length > 80) errores.push('El nombre no puede pasar de 80 caracteres');
  if (!categoria) errores.push('La categoría es obligatoria');
  if (datos?.precio === '' || !Number.isFinite(precio) || precio <= 0) errores.push('El precio debe ser mayor a 0');
  if (datos?.stock === '' || !Number.isInteger(stock) || stock < 0)
    errores.push('El stock debe ser un número entero mayor o igual a 0');

  return {
    errores,
    producto: { nombre, categoria, precio: Math.round(precio * 100) / 100, stock },
  };
}
