import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

export default function NineBoxEmpleadoPanel({ employeeId }) {
  const [datos, setDatos] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getNineBoxEmpleado(employeeId), api.getPotencialHistorial(employeeId)])
      .then(([d, h]) => { setDatos(d); setHistorial(h); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [employeeId]);

  if (cargando) return <div className="panel"><p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p></div>;
  if (error) return <div className="panel"><p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p></div>;

  if (!datos?.disponible) {
    return (
      <div className="panel">
        <h2>Nine Box</h2>
        <p className="muted" style={{ fontSize: "0.88rem" }}>
          Todavía no tiene cargados los dos datos necesarios (Desempeño 0-100 y Potencial) para
          ubicarlo en el Nine Box. Esto solo aplica a puestos clave y mandos.
        </p>
      </div>
    );
  }

  const DIMENSIONES = [
    { nombre: "Aprendizaje", valor: datos.potencial.aprendizajePromedio },
    { nombre: "Aspiración", valor: datos.potencial.aspiracionPromedio },
    { nombre: "Compromiso", valor: datos.potencial.compromisoPromedio },
    { nombre: "Liderazgo", valor: datos.potencial.liderazgoPromedio },
  ];

  return (
    <div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h2>Posición actual en el Nine Box</h2>
          <div className="badge-facts">
            <div>
              <div className="fact-label">Celda</div>
              <div className="fact-value" style={{ fontSize: "1.1rem" }}>{datos.nombreCelda}</div>
            </div>
            <div>
              <div className="fact-label">Desempeño</div>
              <div className="fact-value">{datos.desempenoNivel} <span className="muted" style={{ fontSize: "0.7em" }}>({datos.puntajeCompetencias})</span></div>
            </div>
            <div>
              <div className="fact-label">Potencial</div>
              <div className="fact-value">{datos.potencialNivel} <span className="muted" style={{ fontSize: "0.7em" }}>({datos.potencial.potencialFinal})</span></div>
            </div>
          </div>
          {datos.focoDesarrollo && (
            <p style={{ fontSize: "0.85rem", marginTop: 14 }}><strong>Foco de desarrollo:</strong> {datos.focoDesarrollo}</p>
          )}
          {datos.accionSugerida && (
            <p style={{ fontSize: "0.85rem" }}><strong>Acción sugerida:</strong> {datos.accionSugerida}</p>
          )}
          <p className="muted" style={{ fontSize: "0.76rem", marginTop: 10 }}>
            Potencial evaluado el {formatFecha(datos.potencial.fecha)} por {datos.potencial.evaluador || "—"}.
          </p>
        </div>

        <div className="panel">
          <h2>Dimensiones de Potencial</h2>
          {DIMENSIONES.map((d) => (
            <div className="history-row" key={d.nombre}>
              <span>{d.nombre}</span>
              <span className="status-pill teal" style={{ fontSize: "0.78rem" }}>{d.valor} / 4</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h2>Detalle de las 12 preguntas</h2>
        {datos.respuestas.map((r) => (
          <div key={r.preguntaNumero} className="history-row" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{r.preguntaNumero}.</strong> {r.opcionTexto}
              {r.comentario && <div className="muted" style={{ fontSize: "0.78rem", marginTop: 3 }}>Evidencia: {r.comentario}</div>}
            </div>
            <span className="status-pill" style={{ fontSize: "0.76rem" }}>{r.puntaje}/4</span>
          </div>
        ))}
      </div>

      {historial && historial.length > 1 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>Historial de evaluaciones de Potencial</h2>
          {historial.map((h) => (
            <div className="history-row" key={h.id}>
              <span>{formatFecha(h.fecha)} <span className="muted">— {h.evaluador || "—"}</span></span>
              <span className="status-pill teal" style={{ fontSize: "0.78rem" }}>{h.potencialFinal} ({h.potencialNivel})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
