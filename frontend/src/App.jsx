import { useEffect, useState } from 'react';
import Login from './components/Login.jsx';
import Sistema from './components/Sistema.jsx';

const CLAVE_SESION = 'sistema-cloud-sesion';
const CLAVE_TEMA = 'sistema-cloud-tema';

function leer(clave) {
  try {
    return JSON.parse(sessionStorage.getItem(clave) || localStorage.getItem(clave) || 'null');
  } catch {
    return null;
  }
}

export default function App() {
  const [sesion, setSesion] = useState(() => leer(CLAVE_SESION));
  const [tema, setTema] = useState(() => leer(CLAVE_TEMA) || 'claro');

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try {
      localStorage.setItem(CLAVE_TEMA, JSON.stringify(tema));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [tema]);

  const iniciarSesion = (datos) => {
    setSesion(datos);
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(datos));
    } catch {
      /* almacenamiento no disponible */
    }
  };

  const cerrarSesion = () => {
    setSesion(null);
    try {
      sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      /* almacenamiento no disponible */
    }
  };

  const alternarTema = () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'));

  return sesion ? (
    <Sistema sesion={sesion} onCerrarSesion={cerrarSesion} tema={tema} onAlternarTema={alternarTema} />
  ) : (
    <Login onLogin={iniciarSesion} />
  );
}
