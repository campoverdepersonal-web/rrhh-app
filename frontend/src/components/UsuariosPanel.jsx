import { useEffect, useState } from "react";
import { api } from "../api.js";

const ROLES = [
  { value: "ADMIN", label: "Administrador" },
  { value: "RRHH", label: "RRHH" },
  { value: "LIDER", label: "Líder" },
];

export default function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "RRHH" });

  function cargar() {
    setCargando(true);
    api.listUsuarios().then(setUsuarios).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.crearUsuario(form);
      setForm({ nombre: "", email: "", password: "", rol: "RRHH" });
      setFormVisible(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function toggleActivo(u) {
    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)));
    try {
      await api.actualizarUsuario(u.id, { activo: !u.activo });
    } catch (err) {
      setError(err.message);
      cargar();
    }
  }

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Usuarios</h1>
          <p className="legajo-sub">Gestión de cuentas de acceso al sistema</p>
        </div>
      </div>

      <div className="panel">
        {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
        {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
        {!cargando && usuarios.map((u) => (
          <div className="history-row" key={u.id}>
            <span>
              <strong>{u.nombre}</strong>
              <span className="muted"> · {u.email} · {ROLES.find((r) => r.value === u.rol)?.label}</span>
            </span>
            <button
              className={`status-pill ${u.activo ? "teal" : "red"}`}
              style={{ border: "none", cursor: "pointer", fontSize: "0.78rem", padding: "3px 10px" }}
              onClick={() => toggleActivo(u)}
            >
              {u.activo ? "Activo" : "Inactivo"}
            </button>
          </div>
        ))}

        {!formVisible && (
          <button className="btn-primary" onClick={() => setFormVisible(true)}>
            Crear cuenta
          </button>
        )}

        {formVisible && (
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            <div className="form-grid">
              <label>
                Nombre
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </label>
              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label>
                Contraseña
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
              </label>
              <label>
                Rol
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
            </div>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Creando…" : "Crear cuenta"}
            </button>
          </form>
        )}
      </div>

      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 14 }}>
        El rol todavía no restringe funcionalidades dentro del sistema (excepto la gestión
        de usuarios, que es solo para Administradores) — es la base para ir agregando
        permisos más específicos por rol en el futuro.
      </p>
    </div>
  );
}
