import { useEffect, useState } from "react";
import { api } from "../api.js";

const SECCIONES = [
  { key: "sinEvaluacionReciente", titulo: "Sin evaluación reciente", emoji: "🕓", color: "amber",
    descripcion: (c) => `Personal efectivo: +${c.diasSinEvaluacionEfectivo} días. En período de prueba: +${c.diasSinEvaluacionPrueba} días. O nunca evaluados.` },
  { key: "sancionesAcumuladas", titulo: "Sanciones acumuladas", emoji: "🚩", color: "red",
    descripcion: (c) => `${c.umbralSancionesAcumuladas}+ sanciones en los últimos ${c.diasSancionesRecientes} días.` },
  { key: "bajaDesempeno", titulo: "Baja de desempeño", emoji: "📉", color: "red",
    descripcion: (c) => `Cayó ${c.caidaDesempenoPuntos}+ puntos entre sus últimas dos evaluaciones.` },
  { key: "cursosIncompletos", titulo: "Cursos sin completar", emoji: "🎓", color: "amber",
    descripcion: (c) => `Pendiente/en curso hace más de ${c.diasCursoSinCompletar} días, o marcado no completado.` },
  { key: "resultadosSobresalientes", titulo: "Resultados sobresalientes", emoji: "⭐", color: "teal",
    descripcion: (c) => `Última evaluación ≥ ${c.umbralSobresaliente} puntos.` },
  { key: "candidatosPromocion", titulo: "Candidatos a promoción", emoji: "🚀", color: "teal",
    descripcion: (c) => `Promedio ≥ ${c.umbralPromocionPromedio}, sin sanciones, ${Math.floor(c.diasAntiguedadPromocion / 365)}+ año(s) de antigüedad.` },
];

export default function AlertasPanel() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getAlertas().then(setDatos).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="loading-state">Calculando alertas…</div>;
  if (error) return <div className="empty-state">No se pudieron cargar las alertas ({error}).</div>;

  const totalAlertas = SECCIONES.reduce((acc, s) => acc + datos[s.key].length, 0);

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Alertas automáticas</h1>
          <p className="legajo-sub">{totalAlertas} alerta(s) activa(s) entre empleados activos</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        {SECCIONES.map((s) => {
          const items = datos[s.key];
          return (
            <div className="panel" key={s.key}>
              <h2>{s.emoji} {s.titulo} {items.length > 0 && <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· {items.length}</span>}</h2>
              <p className="muted" style={{ fontSize: "0.78rem", marginTop: -4 }}>{s.descripcion(datos.configuracion)}</p>
              {items.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>Sin casos por ahora.</p>
              ) : (
                items.map((it) => (
                  <div className="history-row" key={it.id}>
                    <span>{it.nombre} <span className="muted">— {it.puesto}</span></span>
                    <span className={`status-pill ${s.color}`} style={{ fontSize: "0.72rem", padding: "3px 9px", textAlign: "right", maxWidth: 220 }}>
                      {it.detalle}
                    </span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 16 }}>
        Los umbrales (días, puntajes) son los mismos para todos los puestos por ahora — se pueden
        ajustar a futuro si hace falta diferenciarlos.
      </p>
    </div>
  );
}
