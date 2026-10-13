/**
 * API REST de productos (Netlify Function, Node.js).
 *
 *   GET     /api/productos        → Consultar registros   (READ)
 *   GET     /api/productos/:id    → Consultar un registro
 *   POST    /api/productos        → Crear registro        (CREATE)
 *   PUT     /api/productos/:id    → Actualizar registro   (UPDATE)
 *   DELETE  /api/productos/:id    → Eliminar registro     (DELETE)
 *
 * También responde en /.netlify/functions/productos[/:id].
 * Las operaciones que modifican datos requieren haber iniciado sesión.
 */
import { listarProductos, crearProducto, actualizarProducto, eliminarProducto } from '../lib/sheets.js';
import { respuesta, sesionValida, validarProducto } from '../lib/http.js';

/** Obtiene el :id de rutas como /api/productos/3 o /.netlify/functions/productos/3 */
function obtenerId(path = '') {
  const coincidencia = path.match(/productos\/?([^/?]*)\/?$/);
  return coincidencia && coincidencia[1] ? coincidencia[1] : null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respuesta(204, {});

  const id = obtenerId(event.path);
  if (id !== null && !/^\d+$/.test(id)) return respuesta(400, { error: 'El ID debe ser numérico' });

  // Crear, actualizar y eliminar solo con sesión iniciada
  if (['POST', 'PUT', 'DELETE'].includes(event.httpMethod) && !sesionValida(event)) {
    return respuesta(401, { error: 'Sesión no válida. Inicia sesión de nuevo.' });
  }

  try {
    switch (event.httpMethod) {
      case 'GET': {
        const productos = await listarProductos();
        if (id) {
          const producto = productos.find((p) => p.id === Number(id));
          return producto ? respuesta(200, producto) : respuesta(404, { error: 'Producto no encontrado' });
        }
        return respuesta(200, { origen: 'Google Sheets', total: productos.length, productos });
      }

      case 'POST': {
        if (id) return respuesta(400, { error: 'Para crear no se envía ID en la ruta' });
        const { errores, producto } = validarProducto(parseCuerpo(event));
        if (errores.length) return respuesta(400, { error: errores.join('. '), errores });
        const creado = await crearProducto(producto);
        return respuesta(201, { mensaje: 'Producto creado', producto: creado });
      }

      case 'PUT': {
        if (!id) return respuesta(400, { error: 'Falta el ID del producto en la ruta' });
        const { errores, producto } = validarProducto(parseCuerpo(event));
        if (errores.length) return respuesta(400, { error: errores.join('. '), errores });
        const actualizado = await actualizarProducto(id, producto);
        return actualizado
          ? respuesta(200, { mensaje: 'Producto actualizado', producto: actualizado })
          : respuesta(404, { error: 'Producto no encontrado' });
      }

      case 'DELETE': {
        if (!id) return respuesta(400, { error: 'Falta el ID del producto en la ruta' });
        const eliminado = await eliminarProducto(id);
        return eliminado
          ? respuesta(200, { mensaje: 'Producto eliminado', id: Number(id) })
          : respuesta(404, { error: 'Producto no encontrado' });
      }

      default:
        return respuesta(405, { error: `Método ${event.httpMethod} no permitido` });
    }
  } catch (err) {
    if (err instanceof SyntaxError) return respuesta(400, { error: 'El cuerpo de la petición no es JSON válido' });
    console.error(err);
    return respuesta(500, { error: err.message });
  }
};

function parseCuerpo(event) {
  const texto = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body;
  return JSON.parse(texto || '{}');
}
