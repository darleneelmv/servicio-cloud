import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!usuario.trim() || !contrasena) {
      setError('Escribe tu usuario y contraseña');
      return;
    }
    setCargando(true);
    try {
      const res = await api.login(usuario.trim(), contrasena);
      onLogin({ usuario: res.usuario, token: res.token });
    } catch (err) {
      setError(err.message);
      setContrasena('');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="login">
      <div className="login__fondo" aria-hidden="true" />
      <form className="login__tarjeta" onSubmit={enviar} noValidate>
        <div className="marca">
          <span className="marca__icono" aria-hidden="true">☁️</span>
          <div>
            <h1>Sistema Cloud</h1>
            <p>Inventario de productos</p>
          </div>
        </div>

        <label className="campo">
          <span>Usuario</span>
          <input
            type="text"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Escribe tu usuario"
            autoFocus
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div className="alerta alerta--error" role="alert">
            ⚠️ {error}
          </div>
        )}

        <button className="btn btn--primario btn--bloque" type="submit" disabled={cargando}>
          {cargando ? 'Verificando…' : 'Iniciar sesión'}
        </button>

        <p className="login__pie">React · API REST Node.js · Google Sheets · Netlify</p>
      </form>
    </main>
  );
}
