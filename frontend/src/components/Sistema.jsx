import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import ProductoForm from './ProductoForm.jsx';
import Modal from './Modal.jsx';

const CATEGORIAS_BASE = ['Computación', 'Accesorios', 'Electrónica', 'Oficina', 'Redes', 'Almacenamiento'];
const STOCK_BAJO = 5;

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const ORDENES = {
  'id-asc': { texto: 'ID (ascendente)', fn: (a, b) => a.id - b.id },
  'nombre-asc': { texto: 'Nombre (A–Z)', fn: (a, b) => a.nombre.localeCompare(b.nombre, 'es') },
  'nombre-desc': { texto: 'Nombre (Z–A)', fn: (a, b) => b.nombre.localeCompare(a.nombre, 'es') },
  'precio-asc': { texto: 'Precio (menor a mayor)', fn: (a, b) => a.precio - b.precio },
  'precio-desc': { texto: 'Precio (mayor a menor)', fn: (a, b) => b.precio - a.precio },
  'stock-asc': { texto: 'Stock (menor a mayor)', fn: (a, b) => a.stock - b.stock },
  'fecha-desc': { texto: 'Más recientes', fn: (a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '') },
};

export default function Sistema({ sesion, onCerrarSesion, tema, onAlternarTema }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [sincronizado, setSincronizado] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [orden, setOrden] = useState('id-asc');

  const [editando, setEditando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [borrandoAhora, setBorrandoAhora] = useState(false);
  const [aviso, setAviso] = useState(null);

  const mostrarAviso = useCallback((tipo, texto) => {
    setAviso({ tipo, texto, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  // READ: consulta los registros guardados en Google Sheets mediante la API REST
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const res = await api.listar();
      setProductos(res.productos);
      setSincronizado(new Date());
    } catch (err) {
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const manejarError = (err) => {
    if (err.status === 401) {
      onCerrarSesion();
      return;
    }
    mostrarAviso('error', err.message);
  };

  // CREATE
  const crear = async (datos) => {
    try {
      const res = await api.crear(datos, sesion.token);
      mostrarAviso('exito', `“${res.producto.nombre}” se guardó en Google Sheets`);
      await cargar();
      return true;
    } catch (err) {
      manejarError(err);
      return false;
    }
  };

  // UPDATE
  const actualizar = async (datos) => {
    try {
      const res = await api.actualizar(editando.id, datos, sesion.token);
      mostrarAviso('exito', `“${res.producto.nombre}” se actualizó en Google Sheets`);
      setEditando(null);
      await cargar();
      return true;
    } catch (err) {
      manejarError(err);
      return false;
    }
  };

  // DELETE
  const eliminar = async () => {
    setBorrandoAhora(true);
    try {
      await api.eliminar(eliminando.id, sesion.token);
      mostrarAviso('exito', `“${eliminando.nombre}” se eliminó de Google Sheets`);
      setEliminando(null);
      await cargar();
    } catch (err) {
      manejarError(err);
    } finally {
      setBorrandoAhora(false);
    }
  };

  const categorias = useMemo(
    () => [...new Set([...CATEGORIAS_BASE, ...productos.map((p) => p.categoria).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')),
    [productos]
  );
  const categoriasEnUso = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [productos]
  );

  // Búsqueda + filtro + ordenamiento
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productos
      .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
      .filter((p) => !categoria || p.categoria === categoria)
      .sort(ORDENES[orden].fn);
  }, [productos, busqueda, categoria, orden]);

  // Contadores (dashboard)
  const resumen = useMemo(
    () => ({
      total: productos.length,
      unidades: productos.reduce((s, p) => s + p.stock, 0),
      valor: productos.reduce((s, p) => s + p.precio * p.stock, 0),
      bajo: productos.filter((p) => p.stock <= STOCK_BAJO).length,
    }),
    [productos]
  );

  const hayFiltros = busqueda || categoria;

  return (
    <div className="app">
      <header className="barra">
        <div className="marca marca--chica">
          <span className="marca__icono" aria-hidden="true">☁️</span>
          <div>
            <h1>Sistema Cloud</h1>
            <p>Inventario de productos</p>
          </div>
        </div>
        <div className="barra__acciones">
          <button className="btn-icono" onClick={onAlternarTema} title="Cambiar tema" aria-label="Cambiar tema">
            {tema === 'oscuro' ? '☀️' : '🌙'}
          </button>
          <span className="usuario">
            <span className="usuario__avatar">{sesion.usuario[0]?.toUpperCase()}</span>
            {sesion.usuario}
          </span>
          <button className="btn btn--fantasma" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="contenido">
        <section className="resumen" aria-label="Resumen del inventario">
          <Tarjeta titulo="Total de registros" valor={resumen.total} />
          <Tarjeta titulo="Unidades en stock" valor={resumen.unidades.toLocaleString('es-MX')} />
          <Tarjeta titulo="Valor del inventario" valor={dinero.format(resumen.valor)} />
          <Tarjeta titulo={`Stock bajo (≤ ${STOCK_BAJO})`} valor={resumen.bajo} alerta={resumen.bajo > 0} />
        </section>

        <div className="rejilla">
          <section className="panel panel--form">
            <h2>➕ Nuevo producto</h2>
            <p className="panel__nota">Se guarda directamente en Google Sheets a través de la API REST.</p>
            <ProductoForm categorias={categorias} onGuardar={crear} />
          </section>

          <section className="panel panel--tabla">
            <div className="panel__encabezado">
              <div>
                <h2>📋 Productos</h2>
                <p className="origen">
                  <span className={`punto ${errorCarga ? 'punto--error' : cargando ? 'punto--carga' : ''}`} />
                  Origen: Google Sheets
                  {sincronizado && ` · sincronizado ${sincronizado.toLocaleTimeString('es-MX')}`}
                </p>
              </div>
              <button className="btn btn--fantasma" onClick={cargar} disabled={cargando}>
                ⟳ {cargando ? 'Consultando…' : 'Actualizar'}
              </button>
            </div>

            <div className="herramientas">
              <label className="buscador">
                <span aria-hidden="true">🔎</span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre…"
                  aria-label="Buscar por nombre"
                />
              </label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por categoría">
                <option value="">Todas las categorías</option>
                {categoriasEnUso.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar por">
                {Object.entries(ORDENES).map(([clave, o]) => (
                  <option key={clave} value={clave}>
                    Ordenar: {o.texto}
                  </option>
                ))}
              </select>
            </div>

            <p className="contador">
              Mostrando <strong>{visibles.length}</strong> de <strong>{productos.length}</strong> registros
              {hayFiltros && (
                <button
                  className="enlace"
                  onClick={() => {
                    setBusqueda('');
                    setCategoria('');
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </p>

            {errorCarga ? (
              <div className="alerta alerta--error">
                ⚠️ No se pudo consultar Google Sheets: {errorCarga}
              </div>
            ) : cargando && !productos.length ? (
              <div className="vacio">Consultando Google Sheets…</div>
            ) : !visibles.length ? (
              <div className="vacio">
                {productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos. Agrega el primero.'}
              </div>
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th className="num">Precio</th>
                      <th>Categoría</th>
                      <th className="num">Stock</th>
                      <th>Creado</th>
                      <th className="acciones">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((p) => (
                      <tr key={p.id}>
                        <td data-label="ID" className="mono">{p.id}</td>
                        <td data-label="Nombre" className="nombre">{p.nombre}</td>
                        <td data-label="Precio" className="num">{dinero.format(p.precio)}</td>
                        <td data-label="Categoría">
                          <span className="etiqueta">{p.categoria}</span>
                        </td>
                        <td data-label="Stock" className="num">
                          <span className={p.stock <= STOCK_BAJO ? 'stock stock--bajo' : 'stock'}>{p.stock}</span>
                        </td>
                        <td data-label="Creado" className="tenue">{fecha(p.fechaCreacion)}</td>
                        <td className="acciones">
                          <button className="btn btn--chico" onClick={() => setEditando(p)}>
                            ✏️ Editar
                          </button>
                          <button className="btn btn--chico btn--peligro" onClick={() => setEliminando(p)}>
                            🗑 Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {editando && (
        <Modal titulo={`Editar producto #${editando.id}`} onCerrar={() => setEditando(null)}>
          <ProductoForm
            inicial={editando}
            categorias={categorias}
            onGuardar={actualizar}
            onCancelar={() => setEditando(null)}
            textoBoton="Guardar cambios"
          />
        </Modal>
      )}

      {eliminando && (
        <Modal titulo="Confirmar eliminación" onCerrar={() => !borrandoAhora && setEliminando(null)}>
          <p className="confirmar">
            ¿Deseas eliminar este registro?
            <br />
            <strong>
              #{eliminando.id} · {eliminando.nombre}
            </strong>
            <br />
            <span className="tenue">También se borrará de Google Sheets. Esta acción no se puede deshacer.</span>
          </p>
          <div className="formulario__acciones">
            <button className="btn btn--fantasma" onClick={() => setEliminando(null)} disabled={borrandoAhora}>
              Cancelar
            </button>
            <button className="btn btn--peligro-solido" onClick={eliminar} disabled={borrandoAhora}>
              {borrandoAhora ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}

      {aviso && (
        <div key={aviso.id} className={`aviso aviso--${aviso.tipo}`} role="status">
          {aviso.tipo === 'exito' ? '✅' : '⚠️'} {aviso.texto}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, alerta }) {
  return (
    <div className={`tarjeta ${alerta ? 'tarjeta--alerta' : ''}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}
