import { useState } from "react";
import { api } from "../api.js";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const usuario = await api.login(email, password);
      onLogin(usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand" style={{ justifyContent: "center", marginBottom: 6 }}>
          <span className="brand-mark">RH</span>
          Legajo dinámico
        </div>
        <p className="legajo-sub" style={{ textAlign: "center", marginBottom: 20 }}>
          Ingresá con tu cuenta para continuar
        </p>

        <label className="filtro-label">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            autoFocus
            required
          />
        </label>
        <label className="filtro-label" style={{ marginTop: 10 }}>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem", marginTop: 10 }}>{error}</p>}

        <button className="btn-primary" type="submit" disabled={enviando} style={{ width: "100%", marginTop: 18 }}>
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
