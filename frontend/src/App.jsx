import { useEffect, useState } from "react";
import { api, setOnUnauthorized } from "./api.js";
import LegajoEmpleado from "./components/LegajoEmpleado.jsx";
import DashboardRRHH from "./components/DashboardRRHH.jsx";
import ComparativosDashboard from "./components/ComparativosDashboard.jsx";
import FiltrosPanel, { useEmpleadosFiltrados, FILTROS_VACIOS } from "./components/FiltrosPanel.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import UsuariosPanel from "./components/UsuariosPanel.jsx";
import ImportarPanel from "./components/ImportarPanel.jsx";
import CompetenciasDictionary from "./components/CompetenciasDictionary.jsx";
import AlertasPanel from "./components/AlertasPanel.jsx";
import BajasPanel from "./components/BajasPanel.jsx";
import TopNav from "./components/TopNav.jsx";

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
  const hayBusquedaActiva = busqueda.trim() !== "" || Object.values(filtros).some(Boolean);

  if (!usuario) {
    return <LoginScreen onLogin={setUsuario} />;
  }

  function cerrarSesion() {
    api.logout();
    setUsuario(null);
  }

  function seleccionar(id) {
    setSeleccionadoId(id);
  }

  const activosCount = empleados.filter((e) => e.estado === "ACTIVO").length;

  return (
    <div className="app-frame">
      <TopNav vista={vista} setVista={setVista} usuario={usuario} cerrarSesion={cerrarSesion} />

      <div className={vista === "legajos" ? "app-body con-sidebar" : "app-body"}>
        {vista === "legajos" && (
          <aside className="sidebar">
            <input
              className="employee-search"
              placeholder="Buscar por nombre o legajo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <FiltrosPanel empleados={empleados} filtros={filtros} setFiltros={setFiltros} />

            {!hayBusquedaActiva && (
              <div className="sidebar-prompt">
                <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                  Buscá un nombre o legajo, o usá los filtros, para ver empleados.
                </p>
                <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                  {activosCount} empleado{activosCount !== 1 ? "s" : ""} activo{activosCount !== 1 ? "s" : ""} en la nómina.
                </p>
              </div>
            )}

            {hayBusquedaActiva && (
              <>
                <p className="muted" style={{ fontSize: "0.76rem", margin: "-2px 2px 4px" }}>
                  {filtrados.length} de {empleados.length} empleados
                </p>
                <ul className="employee-list">
                  {filtrados.map((e) => (
                    <li key={e.id}>
                      <button
                        className="employee-list-item"
                        aria-current={e.id === seleccionadoId}
                        onClick={() => seleccionar(e.id)}
                      >
                        <span className={`dot ${e.periodoPrueba.etiqueta.color}`} />
                        <span>
                          <div className="name">{e.nombre} {e.apellido}</div>
                          <div className="role">{e.puesto}</div>
                        </span>
                      </button>
                    </li>
                  ))}
                  {filtrados.length === 0 && (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Sin resultados.</p>
                  )}
                </ul>
              </>
            )}
          </aside>
        )}

        <main className="main">
          {vista === "dashboard" && <DashboardRRHH />}
          {vista === "comparativos" && <ComparativosDashboard />}
          {vista === "usuarios" && usuario.rol === "ADMIN" && <UsuariosPanel />}
          {vista === "importar" && <ImportarPanel onImportado={cargarListado} />}
          {vista === "competencias" && <CompetenciasDictionary />}
          {vista === "alertas" && <AlertasPanel />}
          {vista === "bajas" && <BajasPanel usuario={usuario} />}
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
                <div className="empty-state">
                  {hayBusquedaActiva ? "Elegí un empleado de la lista para ver su legajo." : "Buscá o filtrá para encontrar a alguien."}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
