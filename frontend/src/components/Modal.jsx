import { useEffect } from 'react';

export default function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={onCerrar}>
      <div className="modal__caja" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal__encabezado">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
