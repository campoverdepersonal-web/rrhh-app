import { useEffect, useState } from "react";
import { api, setOnUnauthorized } from "./api.js";
import LegajoEmpleado from "./components/LegajoEmpleado.jsx";
import DashboardRRHH from "./components/DashboardRRHH.jsx";
import ComparativosDashboard from "./components/ComparativosDashboard.jsx";
import FiltrosPanel, { useEmpleadosFiltrados, FILTROS_VACIOS } from "./components/FiltrosPanel.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import UsuariosPanel from "./components/UsuariosPanel.jsx";
import ImportarPanel from "./components/ImportarPanel.jsx";

export default function App() {
  const [usuario, setUsuario] = useState(() => api.getUsuarioActual());
  const [vista, setVista] = useState("legajos");
  const [empleados, setEmpleados] = useState([]);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  async function cargarListado() {
    try {
      const data = await api.listEmployees();
      setEmpleados(data);
      if (!seleccionadoId && data.length) setSeleccionadoId(data[0].id);
    } catch (err) {
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    setOnUnauthorized(() => {
      api.logout();
      setUsuario(null);
    });
  }, []);

  useEffect(() => { if (usuario) cargarListado(); }, [usuario]);

  useEffect(() => {
    if (!seleccionadoId || !usuario) return;
    api.getEmployee(seleccionadoId).then(setDetalle).catch((err) => setErrorCarga(err.message));
  }, [seleccionadoId, usuario]);

  const filtrados = useEmpleadosFiltrados(empleados, busqueda, filtros);

  if (!usuario) {
    return <LoginScreen onLogin={setUsuario} />;
  }

  function cerrarSesion() {
    api.logout();
    setUsuario(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">RH</span>
          Legajo dinámico
        </div>
        <div className="nav-tabs">
          <button className="nav-tab" aria-current={vista === "legajos"} onClick={() => setVista("legajos")}>
            Legajos
          </button>
          <button className="nav-tab" aria-current={vista === "dashboard"} onClick={() => setVista("dashboard")}>
            Dashboard RRHH
          </button>
          <button className="nav-tab" aria-current={vista === "comparativos"} onClick={() => setVista("comparativos")}>
            Comparativos
          </button>
          <button className="nav-tab" aria-current={vista === "importar"} onClick={() => setVista("importar")}>
            Importar
          </button>
          {usuario.rol === "ADMIN" && (
            <button className="nav-tab" aria-current={vista === "usuarios"} onClick={() => setVista("usuarios")}>
              Usuarios
            </button>
          )}
        </div>
        <div className="account-bar">
          <span>👤 {usuario.nombre}</span>
          <button className="link-button" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
        <input
          className="employee-search"
          placeholder="Buscar por nombre o legajo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <FiltrosPanel empleados={empleados} filtros={filtros} setFiltros={setFiltros} />
        <p className="muted" style={{ fontSize: "0.76rem", margin: "-8px 2px 0" }}>
          {filtrados.length} de {empleados.length} empleados
        </p>
        <ul className="employee-list">
          {filtrados.map((e) => (
            <li key={e.id}>
              <button
                className="employee-list-item"
                aria-current={e.id === seleccionadoId}
                onClick={() => setSeleccionadoId(e.id)}
              >
                <span className={`dot ${e.periodoPrueba.etiqueta.color}`} />
                <span>
                  <div className="name">{e.nombre} {e.apellido}</div>
                  <div className="role">{e.puesto}</div>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        {vista === "dashboard" && <DashboardRRHH />}
        {vista === "comparativos" && <ComparativosDashboard />}
        {vista === "usuarios" && usuario.rol === "ADMIN" && <UsuariosPanel />}
        {vista === "importar" && <ImportarPanel onImportado={cargarListado} />}
        {vista === "legajos" && (
          <>
            {errorCarga && (
              <div className="empty-state">
                No se pudo conectar con la API ({errorCarga}). Verificá que el backend esté corriendo en
                <code> http://localhost:4000</code> y que la base de datos esté inicializada.
              </div>
            )}
            {!errorCarga && cargando && <div className="loading-state">Cargando legajos…</div>}
            {!errorCarga && !cargando && detalle && (
              <LegajoEmpleado
                empleado={detalle}
                usuario={usuario}
                onDecisionRegistrada={() => { cargarListado(); api.getEmployee(seleccionadoId).then(setDetalle); }}
                onEliminado={() => { setSeleccionadoId(null); setDetalle(null); cargarListado(); }}
              />
            )}
            {!errorCarga && !cargando && !detalle && (
              <div className="empty-state">Seleccioná un empleado para ver su legajo.</div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
