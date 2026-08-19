import { useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api.js";

function descargarPlantilla(nombreArchivo, hojaNombre, datos, anchos) {
  const hoja = XLSX.utils.json_to_sheet(datos);
  if (anchos) hoja["!cols"] = anchos.map((wch) => ({ wch }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, hojaNombre);
  XLSX.writeFile(libro, nombreArchivo);
}

const TIPOS = [
  {
    id: "empleados",
    label: "Empleados",
    titulo: "Importar empleados",
    descripcion: "Cargá muchos empleados de una vez. Si el Legajo ya existe, se actualiza; si es nuevo, se crea.",
    columnas: ["Legajo, Nombre, Apellido, CUIL — obligatorios", "Fecha de ingreso — formato DD/MM/AAAA", "Puesto, Sector, Lugar de trabajo — obligatorios", "Estado — ACTIVO o INACTIVO (opcional)"],
    plantilla: () => descargarPlantilla("plantilla-empleados.xlsx", "Empleados", [
      { "Legajo": "L-0004", "Nombre": "Juan", "Apellido": "Pérez", "CUIL": "20-12345678-3", "Fecha de ingreso": "15/03/2026", "Puesto": "Analista de RRHH", "Sector": "Recursos Humanos", "Lugar de trabajo": "Casa Central", "Estado": "ACTIVO" },
    ], [10, 14, 14, 16, 16, 22, 20, 20, 10]),
    importar: api.importarEmpleados,
    muestraActualizados: true,
  },
  {
    id: "actualizar-puesto",
    label: "Actualizar puesto",
    titulo: "Actualizar puesto de empleados existentes",
    descripcion: "Actualiza SOLO el puesto de empleados que ya existen (por Legajo). No toca ningún otro dato del legajo.",
    columnas: ["Legajo — debe existir en el sistema", "Puesto — nombre nuevo (ideal: que coincida con la matriz de competencias)"],
    plantilla: () => descargarPlantilla("plantilla-actualizar-puesto.xlsx", "Puestos", [
      { "Legajo": "L-0001", "Puesto": "Encargado Fresco" },
    ], [10, 30]),
    importar: api.actualizarPuestosMasivo,
    resultadoActualizarPuesto: true,
  },
  {
    id: "actualizar-legajo",
    label: "Renumerar legajo",
    titulo: "Actualizar N° de legajo de empleados existentes",
    descripcion: "Actualiza SOLO el número de legajo, buscando a la persona por su CUIL (útil cuando cargaste legajos provisorios y ya tenés el definitivo). Valida que el legajo nuevo no esté repetido.",
    columnas: ["CUIL — debe existir en el sistema", "Legajo nuevo"],
    plantilla: () => descargarPlantilla("plantilla-actualizar-legajo.xlsx", "Legajos", [
      { "CUIL": "20-12345678-3", "Legajo nuevo": "554" },
    ], [18, 14]),
    importar: api.actualizarLegajosMasivo,
    resultadoActualizarPuesto: true,
  },
  {
    id: "bajas",
    label: "Bajas",
    titulo: "Importar bajas de empleados",
    descripcion: "Si el Legajo ya existe en el sistema, actualiza sus datos y lo marca como baja. Si no existe, lo crea directamente como baja (para cargar historial de gente que nunca estuvo cargada como activa) — en ese caso Nombre, Apellido, CUIL, Puesto, Sector, Lugar de trabajo y Fecha de alta son obligatorios.",
    columnas: [
      "Legajo — obligatorio",
      "Nombre, Apellido, CUIL — obligatorios si el legajo es nuevo",
      "Puesto, Sector, Lugar de trabajo — obligatorios si el legajo es nuevo",
      "Fecha de alta — formato DD/MM/AAAA, obligatoria si el legajo es nuevo",
      "Fecha de baja — obligatoria siempre, formato DD/MM/AAAA",
      "Motivo — opcional (ej: Renuncia, Despido, Fin de contrato)",
    ],
    plantilla: () => descargarPlantilla("plantilla-bajas.xlsx", "Bajas", [
      { "Legajo": "L-0001", "Nombre": "Juan", "Apellido": "Pérez", "CUIL": "20-12345678-3", "Puesto": "Vendedor", "Sector": "Comercial", "Lugar de trabajo": "Sucursal Centro", "Fecha de alta": "01/01/2023", "Fecha de baja": "15/07/2026", "Motivo": "Renuncia" },
    ], [10, 14, 14, 16, 20, 16, 20, 14, 14, 20]),
    importar: api.importarBajasMasivo,
    muestraActualizados: true,
  },
  {
    id: "comentarios",
    label: "Comentarios",
    titulo: "Importar comentarios de líderes",
    descripcion: "Cada fila agrega un comentario nuevo al historial del empleado (no reemplaza nada existente).",
    columnas: ["Legajo — debe existir en el sistema", "Fecha — formato DD/MM/AAAA", "Líder, Comentario — obligatorios", "Tipo — Positivo, Negativo, Correctivo, Observación o Felicitación", "Lugar de trabajo — opcional"],
    plantilla: () => descargarPlantilla("plantilla-comentarios.xlsx", "Comentarios", [
      { "Legajo": "L-0001", "Fecha": "15/03/2026", "Líder": "Ana Torres", "Tipo": "Positivo", "Comentario": "Excelente actitud en el cierre de mes", "Lugar de trabajo": "Casa Central" },
    ], [10, 14, 16, 14, 40, 20]),
    importar: api.importarComentarios,
  },
  {
    id: "evaluaciones",
    label: "Evaluaciones",
    titulo: "Importar evaluaciones de desempeño",
    descripcion: "Cada fila agrega una evaluación nueva al historial del empleado.",
    columnas: ["Legajo — debe existir en el sistema", "Fecha — formato DD/MM/AAAA", "Evaluador — obligatorio", "Puntaje total — número de 0 a 10 (opcional)", "Resultado, Observaciones — opcionales"],
    plantilla: () => descargarPlantilla("plantilla-evaluaciones.xlsx", "Evaluaciones", [
      { "Legajo": "L-0001", "Fecha": "01/06/2026", "Evaluador": "Ana Torres", "Puntaje total": "8.5", "Resultado": "Cumple expectativas", "Observaciones": "Buen desempeño general" },
    ], [10, 14, 16, 12, 22, 30]),
    importar: api.importarEvaluaciones,
  },
  {
    id: "evaluaciones-competencias",
    label: "Evaluaciones por competencia",
    titulo: "Importar evaluaciones por competencia",
    descripcion: "Para reportes con una fila por cada competencia evaluada (ej. exportados de una encuesta). Las filas que compartan Legajo + Fecha + Evaluador se agrupan como una sola evaluación con todas sus competencias.",
    columnas: ["Legajo — debe existir en el sistema", "Fecha de respuesta, Evaluador — obligatorios", "Título de la competencia — nombre + \"nivel N\" (ej: \"Orientación al cliente nivel 2\")", "Categoría — Competencia blanda o técnica (informativo)", "Respuesta — Malo, Regular, Bueno o Muy Bueno/Excelente", "Puntaje — opcional, numérico"],
    plantilla: () => descargarPlantilla("plantilla-evaluaciones-competencias.xlsx", "Competencias evaluadas", [
      { "Legajo": "L-0001", "Fecha de respuesta": "01/06/2026", "Evaluador": "Ana Torres", "Título de la competencia": "Orientación al Cliente nivel 2", "Categoría": "Competencia blanda", "Respuesta": "Bueno", "Puntaje": 0.63 },
      { "Legajo": "L-0001", "Fecha de respuesta": "01/06/2026", "Evaluador": "Ana Torres", "Título de la competencia": "Trabajo en Equipo y Colaboración nivel 2", "Categoría": "Competencia blanda", "Respuesta": "Regular", "Puntaje": 0.31 },
    ], [10, 16, 16, 40, 20, 14, 12]),
    importar: api.importarEvaluacionesCompetencias,
    resultadoCustom: true,
  },
  {
    id: "sanciones",
    label: "Sanciones",
    titulo: "Importar sanciones",
    descripcion: "Cada fila agrega una sanción nueva al historial del empleado.",
    columnas: ["Legajo — debe existir en el sistema", "Fecha — formato DD/MM/AAAA", "Motivo, Responsable — obligatorios", "Tipo — Apercibimiento, Llamado de Atención o Suspensión"],
    plantilla: () => descargarPlantilla("plantilla-sanciones.xlsx", "Sanciones", [
      { "Legajo": "L-0002", "Fecha": "01/05/2026", "Motivo": "Llegada tarde reiterada", "Tipo": "Llamado de Atención", "Responsable": "Ana Torres" },
    ], [10, 14, 30, 20, 20]),
    importar: api.importarSanciones,
  },
  {
    id: "cursos",
    label: "Cursos",
    titulo: "Importar cursos y capacitaciones",
    descripcion: "Cada fila agrega un curso nuevo al historial del empleado.",
    columnas: ["Legajo — debe existir en el sistema", "Curso — obligatorio", "Modalidad, Fecha — opcionales (fecha en DD/MM/AAAA)", "Estado — Pendiente, En curso, Completado o No completado (opcional, por defecto Pendiente)", "Capacitador, Observaciones — opcionales"],
    plantilla: () => descargarPlantilla("plantilla-cursos.xlsx", "Cursos", [
      { "Legajo": "L-0003", "Curso": "Atención al cliente", "Modalidad": "Virtual", "Fecha": "01/04/2026", "Estado": "Completado", "Capacitador": "Instituto XYZ", "Observaciones": "Muy buena participación" },
    ], [10, 30, 16, 14, 16, 20, 30]),
    importar: api.importarCursos,
  },
  {
    id: "talles-uniforme",
    label: "Talles de uniforme",
    titulo: "Importar talles de uniforme",
    descripcion: "Una fila por empleado. Si el Legajo ya tiene talles cargados, se actualizan.",
    columnas: ["Legajo — debe existir en el sistema", "Remera, Buzo, Pantalón náutico, Pantalón cargo, Calzado, Faja — usar \"N/C\" si no corresponde"],
    plantilla: () => descargarPlantilla("plantilla-talles-uniforme.xlsx", "Talles", [
      { "Legajo": "L-0001", "Remera": "M", "Buzo": "L", "Pantalón náutico": "42", "Pantalón cargo": "42", "Calzado": "39", "Faja": "N/C" },
    ], [10, 10, 10, 16, 16, 10, 10]),
    importar: api.importarTallesUniforme,
    resultadoActualizarPuesto: true,
  },
  {
    id: "entregas-uniforme",
    label: "Entregas de uniforme",
    titulo: "Importar historial de entregas de uniforme",
    descripcion: "Una fila por cada prenda entregada. Se agregan como entregas nuevas al historial.",
    columnas: [
      "Legajo — debe existir en el sistema",
      "Fecha de entrega — formato DD/MM/AAAA",
      "Tipo de prenda — ver lista exacta en la pestaña Uniformes de cualquier legajo",
      "Color/Detalle — debe ser una opción válida para esa prenda (o vacío si la prenda no tiene)",
      "Marca, Talle — opcionales",
      "Cantidad — opcional (por defecto 1)",
      "Estado — Nueva o Usada",
    ],
    plantilla: () => descargarPlantilla("plantilla-entregas-uniforme.xlsx", "Entregas", [
      { "Legajo": "L-0001", "Fecha de entrega": "01/06/2026", "Tipo de prenda": "Remera", "Color/Detalle": "Blanca", "Marca": "OMBU", "Talle": "M", "Cantidad": 2, "Estado": "Nueva" },
      { "Legajo": "L-0001", "Fecha de entrega": "01/06/2026", "Tipo de prenda": "Faja Lumbar", "Color/Detalle": "", "Marca": "BX", "Talle": "M", "Cantidad": 1, "Estado": "Nueva" },
    ], [10, 16, 18, 16, 12, 10, 10, 10]),
    importar: api.importarEntregasUniforme,
    mostrarDuplicados: true,
  },
];

export default function ImportarPanel({ onImportado }) {
  const [tipoId, setTipoId] = useState("empleados");
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const tipo = TIPOS.find((t) => t.id === tipoId);

  function cambiarTipo(id) {
    setTipoId(id);
    setArchivo(null);
    setResultado(null);
    setError(null);
  }

  async function handleImportar() {
    if (!archivo) return;
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const data = await tipo.importar(archivo);
      setResultado(data);
      setArchivo(null);
      onImportado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Importación masiva</h1>
          <p className="legajo-sub">Cargá muchos registros de una vez desde un archivo Excel o CSV</p>
        </div>
      </div>

      <div className="nav-tabs" style={{ marginBottom: 20 }}>
        {TIPOS.map((t) => (
          <button key={t.id} className="nav-tab" aria-current={tipoId === t.id} onClick={() => cambiarTipo(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h2>1. Descargá la plantilla</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>{tipo.descripcion}</p>
          <button className="btn-primary" onClick={tipo.plantilla}>
            📥 Descargar plantilla (.xlsx)
          </button>

          <h2 style={{ marginTop: 20 }}>Columnas esperadas</h2>
          <ul style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)", paddingLeft: 18, margin: 0 }}>
            {tipo.columnas.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>

        <div className="panel">
          <h2>2. Subí tu archivo completo</h2>
          <input
            key={tipoId}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setArchivo(e.target.files[0] || null)}
            style={{ marginBottom: 12 }}
          />
          <br />
          <button className="btn-primary" onClick={handleImportar} disabled={!archivo || enviando}>
            {enviando ? "Importando…" : "Importar"}
          </button>

          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem", marginTop: 12 }}>{error}</p>}

          {resultado && !tipo.resultadoCustom && (
            <div style={{ marginTop: 18 }}>
              <div className="badge-facts" style={{ marginBottom: 14 }}>
                {!tipo.resultadoActualizarPuesto && (
                  <div>
                    <div className="fact-label">{tipo.muestraActualizados ? "Creados" : "Cargados"}</div>
                    <div className="fact-value" style={{ color: "var(--color-teal)" }}>{resultado.insertados}</div>
                  </div>
                )}
                {(tipo.muestraActualizados || tipo.resultadoActualizarPuesto) && (
                  <div>
                    <div className="fact-label">Actualizados</div>
                    <div className="fact-value" style={{ color: "var(--color-primary)" }}>{resultado.actualizados}</div>
                  </div>
                )}
                {tipo.mostrarDuplicados && (
                  <div>
                    <div className="fact-label">Ya existían</div>
                    <div className="fact-value">{resultado.omitidosPorDuplicado || 0}</div>
                  </div>
                )}
                <div>
                  <div className="fact-label">Con errores</div>
                  <div className="fact-value" style={{ color: resultado.errores.length ? "var(--color-red)" : "inherit" }}>
                    {resultado.errores.length}
                  </div>
                </div>
              </div>

              {tipo.mostrarDuplicados && resultado.duplicados?.length > 0 && (
                <>
                  <h2 style={{ fontSize: "0.85rem" }}>Filas que ya existían (no se cargaron de nuevo)</h2>
                  {resultado.duplicados.map((d, i) => (
                    <div className="history-row" key={i}>
                      <span>Fila {d.fila} ({d.legajo})</span>
                      <span className="muted">{d.detalle}</span>
                    </div>
                  ))}
                </>
              )}

              {resultado.errores.length > 0 && (
                <>
                  <h2 style={{ fontSize: "0.85rem" }}>Filas que no se pudieron cargar</h2>
                  {resultado.errores.map((e, i) => (
                    <div className="history-row" key={i}>
                      <span>Fila {e.fila}{e.legajo ? ` (${e.legajo})` : ""}</span>
                      <span className="muted">{e.motivo}</span>
                    </div>
                  ))}
                  {tipo.mostrarDuplicados ? (
                    <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                      Corregí esas filas en tu archivo y volvé a subirlo — las que ya se cargaron
                      bien no se van a duplicar (se detectan por empleado, fecha, prenda, color,
                      marca, talle, cantidad y estado idénticos).
                    </p>
                  ) : (
                    <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                      Corregí esas filas en tu archivo. <strong>Ojo:</strong> si volvés a subir el
                      archivo completo, las filas que ya se cargaron bien se van a duplicar — mejor
                      dejá en el archivo solo las filas que fallaron antes de reimportar.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {resultado && tipo.resultadoCustom && (
            <div style={{ marginTop: 18 }}>
              <div className="badge-facts" style={{ marginBottom: 14 }}>
                <div>
                  <div className="fact-label">Evaluaciones creadas</div>
                  <div className="fact-value" style={{ color: "var(--color-teal)" }}>{resultado.evaluacionesCreadas}</div>
                </div>
                <div>
                  <div className="fact-label">Evaluaciones actualizadas</div>
                  <div className="fact-value" style={{ color: "var(--color-primary)" }}>{resultado.evaluacionesActualizadas}</div>
                </div>
                <div>
                  <div className="fact-label">Competencias cargadas</div>
                  <div className="fact-value">{resultado.totalCompetenciasCargadas}</div>
                </div>
                <div>
                  <div className="fact-label">Con errores</div>
                  <div className="fact-value" style={{ color: resultado.errores.length ? "var(--color-red)" : "inherit" }}>
                    {resultado.errores.length}
                  </div>
                </div>
              </div>

              {resultado.errores.length > 0 && (
                <>
                  <h2 style={{ fontSize: "0.85rem" }}>Filas que no se pudieron cargar</h2>
                  {resultado.errores.map((e, i) => (
                    <div className="history-row" key={i}>
                      <span>Fila {e.fila}</span>
                      <span className="muted">{e.motivo}</span>
                    </div>
                  ))}
                  <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                    Corregí esas filas y volvé a subir el archivo completo — la evaluación se
                    vuelve a armar entera, así que no hace falta separar lo que ya cargó bien.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
