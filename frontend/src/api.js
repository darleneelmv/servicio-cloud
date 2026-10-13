/**
 * Cliente HTTP del frontend. React se comunica con la API REST
 * (Netlify Functions) usando fetch.
 */
const API = '/api';

async function peticion(ruta, { metodo = 'GET', datos, token } = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: datos ? JSON.stringify(datos) : undefined,
  });

  let cuerpo = {};
  try {
    cuerpo = await res.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!res.ok) {
    const error = new Error(cuerpo.error || `Error ${res.status} al comunicarse con la API`);
    error.status = res.status;
    throw error;
  }
  return cuerpo;
}

export const api = {
  login: (usuario, contrasena) => peticion('/login', { metodo: 'POST', datos: { usuario, contrasena } }),
  listar: () => peticion('/productos'),
  crear: (producto, token) => peticion('/productos', { metodo: 'POST', datos: producto, token }),
  actualizar: (id, producto, token) => peticion(`/productos/${id}`, { metodo: 'PUT', datos: producto, token }),
  eliminar: (id, token) => peticion(`/productos/${id}`, { metodo: 'DELETE', token }),
};
