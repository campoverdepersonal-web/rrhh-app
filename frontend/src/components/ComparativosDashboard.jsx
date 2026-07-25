import { useEffect, useState } from "react";
import { api } from "../api.js";

function PromedioPill({ valor }) {
  if (valor === null || valor === undefined) return <span className="muted">s/eval</span>;
  const n = Number(valor);
  const color = n >= 7 ? "teal" : n >= 5 ? "amber" : "red";
  return <span className={`status-pill ${color}`} style={{ fontSize: "0.78rem", padding: "3px 10px" }}>{valor}</span>;
}

export default function ComparativosDashboard() {
  const [modo, setModo] = useState("puestos"); // "puestos" | "lugares"
  const [lista, setLista] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState(null);

  function cargarLista(m) {
    setCargandoLista(true);
    setError(null);
    setDetalle(null);
    setSeleccionado(null);
    const fetcher = m === "puestos" ? api.listPuestos() : api.listLugares();
    fetcher
      .then((data) => {
        setLista(data);
        const clave = m === "puestos" ? data[0]?.puesto : data[0]?.lugarTrabajo;
        setSeleccionado(clave || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargandoLista(false));
  }

  useEffect(() => { cargarLista(modo); }, [modo]);

  useEffect(() => {
    if (!seleccionado) { setDetalle(null); return; }
    setCargandoDetalle(true);
    const fetcher = modo === "puestos" ? api.getPuesto(seleccionado) : api.getLugar(seleccionado);
    fetcher.then(setDetalle).catch((e) => setError(e.message)).finally(() => setCargandoDetalle(false));
  }, [seleccionado, modo]);

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Comparativos</h1>
          <p className="legajo-sub">Compará colaboradores que ocupan un mismo puesto o lugar de trabajo</p>
        </div>
      </div>

      <div className="nav-tabs" style={{ maxWidth: 320, marginBottom: 20 }}>
        <button className="nav-tab" aria-current={modo === "puestos"} onClick={() => setModo("puestos")}>Por puesto</button>
        <button className="nav-tab" aria-current={modo === "lugares"} onClick={() => setModo("lugares")}>Por lugar de trabajo</button>
      </div>

      {error && <div className="empty-state">No se pudo cargar el comparativo ({error}).</div>}

      {!error && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="panel">
            <h2>Ranking {modo === "puestos" ? "de puestos" : "de lugares de trabajo"}</h2>
            {cargandoLista && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
            {!cargandoLista && lista.length === 0 && (
              <p className="muted" style={{ fontSize: "0.88rem" }}>No hay datos suficientes todavía.</p>
            )}
            {!cargandoLista && lista.map((item) => {
              const clave = modo === "puestos" ? item.puesto : item.lugarTrabajo;
              return (
                <button
                  key={clave}
                  onClick={() => setSeleccionado(clave)}
                  className="employee-list-item"
                  aria-current={seleccionado === clave}
                  style={{ width: "100%", justifyContent: "space-between", display: "flex" }}
                >
                  <span>
                    <div className="name">{clave}</div>
                    <div className="role">
                      {modo === "puestos"
                        ? `${item.cantidad_empleados} colaborador(es)`
                        : `${item.cantidadEmpleados} colaborador(es) · ${item.enPeriodoPrueba} en prueba`}
                    </div>
                  </span>
                  <PromedioPill valor={item.promedio} />
                </button>
              );
            })}
          </div>

          <div className="panel">
            {cargandoDetalle && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando detalle…</p>}

            {!cargandoDetalle && detalle && modo === "puestos" && (
              <PuestoDetalle detalle={detalle} />
            )}
            {!cargandoDetalle && detalle && modo === "lugares" && (
              <LugarDetalle detalle={detalle} />
            )}
            {!cargandoDetalle && !detalle && (
              <p className="muted" style={{ fontSize: "0.88rem" }}>Seleccioná uno de la lista para ver el detalle.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PuestoDetalle({ detalle }) {
  const ranking = detalle.ranking || [];
  const necesidadesCapacitacion = detalle.necesidadesCapacitacion || [];

  return (
    <>
      <h2>{detalle.puesto}</h2>
      <div className="badge-facts" style={{ marginBottom: 16 }}>
        <div>
          <div className="fact-label">Promedio del puesto</div>
          <div className="fact-value">{detalle.promedio ?? "—"}</div>
        </div>
        <div>
          <div className="fact-label">Evaluaciones</div>
          <div className="fact-value">{detalle.evaluaciones ?? "—"}</div>
        </div>
        <div>
          <div className="fact-label">Apercibimientos</div>
          <div className="fact-value">{detalle.apercibimientos ?? "—"}</div>
        </div>
      </div>

      <h2 style={{ fontSize: "0.88rem" }}>Ranking de desempeño</h2>
      {ranking.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>Sin colaboradores en este puesto.</p>
      ) : (
        ranking.map((r) => (
          <div className="history-row" key={r.id}>
            <span>{r.nombre} {r.apellido}</span>
            <span className="muted">{r.lugar_trabajo} · <PromedioPill valor={r.promedio} /></span>
          </div>
        ))
      )}

      {necesidadesCapacitacion.length > 0 && (
        <>
          <h2 style={{ fontSize: "0.88rem", marginTop: 16 }}>Necesidades de capacitación</h2>
          {necesidadesCapacitacion.map((n) => (
            <div className="history-row" key={n.curso}>
              <span>{n.curso}</span>
              <span className="muted">{n.pendientes} pendiente(s)</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function LugarDetalle({ detalle }) {
  const cursos = detalle.cursos || { completados: 0, total: 0 };
  const promedioPorPuesto = detalle.promedioPorPuesto || [];

  return (
    <>
      <h2>{detalle.lugarTrabajo}</h2>
      <div className="badge-facts" style={{ marginBottom: 16 }}>
        <div>
          <div className="fact-label">Promedio general</div>
          <div className="fact-value">{detalle.promedioGeneral ?? "—"}</div>
        </div>
        <div>
          <div className="fact-label">Empleados</div>
          <div className="fact-value">{detalle.cantidadEmpleados ?? "—"}</div>
        </div>
        <div>
          <div className="fact-label">En período de prueba</div>
          <div className="fact-value">{detalle.empleadosEnPeriodoPrueba ?? "—"}</div>
        </div>
        <div>
          <div className="fact-label">Empleados evaluados</div>
          <div className="fact-value">{detalle.empleadosEvaluados ?? "—"}</div>
        </div>
        <div>
          <div className="fact-label">Cursos completados</div>
          <div className="fact-value">{cursos.completados} / {cursos.total}</div>
        </div>
        <div>
          <div className="fact-label">Sanciones</div>
          <div className="fact-value">{detalle.sanciones ?? "—"}</div>
        </div>
      </div>

      <h2 style={{ fontSize: "0.88rem" }}>Promedio por puesto</h2>
      {promedioPorPuesto.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>Sin datos suficientes.</p>
      ) : (
        promedioPorPuesto.map((p) => (
          <div className="history-row" key={p.puesto}>
            <span>{p.puesto}</span>
            <PromedioPill valor={p.promedio} />
          </div>
        ))
      )}
    </>
  );
}
