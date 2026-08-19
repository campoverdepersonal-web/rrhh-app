import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";
import LegajoEmpleado from "./LegajoEmpleado.jsx";

export default function BajasPanel({ usuario }) {
  const [bajas, setBajas] = useState([]);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  function cargarLista() {
    setCargando(true);
    api.listBajas()
      .then((data) => {
        setBajas(data);
        if (!seleccionadoId && data.length) setSeleccionadoId(data[0].id);
        if (seleccionadoId && !data.find((b) => b.id === seleccionadoId)) {
          setSeleccionadoId(data[0]?.id || null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargarLista(); }, []);

  useEffect(() => {
    if (!seleccionadoId) { setDetalle(null); return; }
    api.getEmployee(seleccionadoId).then(setDetalle).catch((e) => setError(e.message));
  }, [seleccionadoId]);

  if (error) return <div className="empty-state">No se pudo cargar ({error}).</div>;

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Bajas</h1>
          <p className="legajo-sub">{bajas.length} persona(s) dada(s) de baja — historial conservado para análisis</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
          {!cargando && bajas.length === 0 && (
            <p className="muted" style={{ fontSize: "0.88rem" }}>No hay nadie dado de baja por ahora.</p>
          )}
          {!cargando && bajas.map((b) => (
            <button
              key={b.id}
              className="employee-list-item"
              aria-current={seleccionadoId === b.id}
              onClick={() => setSeleccionadoId(b.id)}
              style={{ width: "100%" }}
            >
              <span>
                <div className="name">{b.nombre} {b.apellido}</div>
                <div className="role">
                  {b.puesto} · Baja: {formatFecha(b.fechaBaja)}
                  {b.motivoBaja ? ` (${b.motivoBaja})` : ""} · Antigüedad: {b.antiguedad}
                </div>
              </span>
            </button>
          ))}
        </div>

        <div>
          {detalle ? (
            <LegajoEmpleado
              empleado={detalle}
              usuario={usuario}
              onDecisionRegistrada={() => { cargarLista(); api.getEmployee(seleccionadoId).then(setDetalle); }}
              onEliminado={() => { setSeleccionadoId(null); setDetalle(null); cargarLista(); }}
            />
          ) : (
            <div className="panel">
              <p className="muted" style={{ fontSize: "0.88rem" }}>Seleccioná a alguien de la lista para ver su legajo completo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
