/**
 * API de inicio de sesión (Netlify Function, Node.js).
 *
 *   POST /api/login   { "usuario": "admin", "contrasena": "12345" }
 *
 * Validación básica: compara contra las variables de entorno
 * ADMIN_USER y ADMIN_PASSWORD (por defecto admin / 12345).
 */
import { respuesta, credenciales, crearToken } from '../lib/http.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respuesta(204, {});
  if (event.httpMethod !== 'POST') return respuesta(405, { error: 'Usa POST para iniciar sesión' });

  let datos;
  try {
    datos = JSON.parse(event.body || '{}');
  } catch {
    return respuesta(400, { error: 'El cuerpo de la petición no es JSON válido' });
  }

  const usuario = String(datos.usuario ?? '').trim();
  const contrasena = String(datos.contrasena ?? '');

  if (!usuario || !contrasena) {
    return respuesta(400, { error: 'Escribe tu usuario y contraseña' });
  }

  const valido = credenciales();
  if (usuario !== valido.usuario || contrasena !== valido.contrasena) {
    return respuesta(401, { error: 'Usuario o contraseña incorrectos' });
  }

  return respuesta(200, { mensaje: 'Bienvenido', usuario, token: crearToken(usuario) });
};
