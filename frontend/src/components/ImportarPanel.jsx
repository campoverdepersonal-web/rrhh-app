import { useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api.js";

function descargarPlantilla() {
  const datos = [
    {
      "Legajo": "L-0004",
      "Nombre": "Juan",
      "Apellido": "Pérez",
      "CUIL": "20-12345678-3",
      "Fecha de ingreso": "15/03/2026",
      "Puesto": "Analista de RRHH",
      "Sector": "Recursos Humanos",
      "Lugar de trabajo": "Casa Central",
      "Estado": "ACTIVO",
    },
  ];
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = [
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 10 },
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Empleados");
  XLSX.writeFile(libro, "plantilla-empleados.xlsx");
}

export default function ImportarPanel({ onImportado }) {
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function handleImportar() {
    if (!archivo) return;
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const data = await api.importarEmpleados(archivo);
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
          <h1>Importar empleados</h1>
          <p className="legajo-sub">Cargá muchos empleados de una vez desde un archivo Excel o CSV</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h2>1. Descargá la plantilla</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Tiene las columnas exactas que el sistema espera, con una fila de ejemplo.
            Completala en Excel (podés borrar la fila de ejemplo) y guardala.
          </p>
          <button className="btn-primary" onClick={descargarPlantilla}>
            📥 Descargar plantilla (.xlsx)
          </button>

          <h2 style={{ marginTop: 20 }}>Columnas esperadas</h2>
          <ul style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)", paddingLeft: 18, margin: 0 }}>
            <li>Legajo, Nombre, Apellido, CUIL — obligatorios</li>
            <li>Fecha de ingreso — formato DD/MM/AAAA</li>
            <li>Puesto, Sector, Lugar de trabajo — obligatorios</li>
            <li>Estado — ACTIVO o INACTIVO (opcional, por defecto ACTIVO)</li>
          </ul>
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
            Si el Legajo de una fila ya existe, se <strong>actualizan</strong> sus datos.
            Si es nuevo, se <strong>crea</strong>. Nunca se borra nada.
          </p>
        </div>

        <div className="panel">
          <h2>2. Subí tu archivo completo</h2>
          <input
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

          {resultado && (
            <div style={{ marginTop: 18 }}>
              <div className="badge-facts" style={{ marginBottom: 14 }}>
                <div>
                  <div className="fact-label">Creados</div>
                  <div className="fact-value" style={{ color: "var(--color-teal)" }}>{resultado.insertados}</div>
                </div>
                <div>
                  <div className="fact-label">Actualizados</div>
                  <div className="fact-value" style={{ color: "var(--color-primary)" }}>{resultado.actualizados}</div>
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
                      <span>Fila {e.fila} ({e.legajo})</span>
                      <span className="muted">{e.motivo}</span>
                    </div>
                  ))}
                  <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                    Corregí esas filas en tu archivo y volvé a subirlo — las que ya se cargaron
                    bien no se van a duplicar.
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
