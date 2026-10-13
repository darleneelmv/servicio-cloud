import { useState } from 'react';

const VACIO = { nombre: '', precio: '', categoria: '', stock: '' };

/** Validación en el navegador: evita registros incompletos o incorrectos. */
export function validar(f) {
  const errores = {};
  if (f.nombre.trim().length < 2) errores.nombre = 'Mínimo 2 caracteres';
  if (f.nombre.trim().length > 80) errores.nombre = 'Máximo 80 caracteres';
  if (f.precio === '' || !(Number(f.precio) > 0)) errores.precio = 'Debe ser mayor a 0';
  if (!f.categoria.trim()) errores.categoria = 'Obligatoria';
  if (f.stock === '' || !Number.isInteger(Number(f.stock)) || Number(f.stock) < 0)
    errores.stock = 'Entero mayor o igual a 0';
  return errores;
}

export default function ProductoForm({ inicial, categorias, onGuardar, onCancelar, textoBoton = 'Agregar' }) {
  const [form, setForm] = useState(() =>
    inicial
      ? { nombre: inicial.nombre, precio: String(inicial.precio), categoria: inicial.categoria, stock: String(inicial.stock) }
      : VACIO
  );
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = validar(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    setGuardando(true);
    const ok = await onGuardar({
      nombre: form.nombre.trim(),
      precio: Number(form.precio),
      categoria: form.categoria.trim(),
      stock: Number(form.stock),
    });
    setGuardando(false);
    if (ok && !inicial) setForm(VACIO);
  };

  const idLista = inicial ? 'categorias-editar' : 'categorias-nuevo';

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <Campo etiqueta="Nombre" error={errores.nombre} ancho>
        <input value={form.nombre} onChange={cambiar('nombre')} placeholder="Ej. Laptop Lenovo" maxLength={80} />
      </Campo>
      <Campo etiqueta="Precio (MXN)" error={errores.precio}>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={form.precio} onChange={cambiar('precio')} placeholder="15000" />
      </Campo>
      <Campo etiqueta="Stock" error={errores.stock}>
        <input type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={cambiar('stock')} placeholder="10" />
      </Campo>
      <Campo etiqueta="Categoría" error={errores.categoria} ancho>
        <input list={idLista} value={form.categoria} onChange={cambiar('categoria')} placeholder="Ej. Computación" />
        <datalist id={idLista}>
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Campo>

      <div className="formulario__acciones">
        {onCancelar && (
          <button type="button" className="btn btn--fantasma" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn--primario" disabled={guardando}>
          {guardando ? 'Guardando en Sheets…' : textoBoton}
        </button>
      </div>
    </form>
  );
}

function Campo({ etiqueta, error, ancho, children }) {
  return (
    <label className={`campo ${ancho ? 'campo--ancho' : ''} ${error ? 'campo--error' : ''}`}>
      <span>{etiqueta}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}
