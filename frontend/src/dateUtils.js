// El backend guarda fechas como DATE (sin hora) y las devuelve como ISO
// ("2026-07-15T00:00:00.000Z"). Si se las pasa directo a `new Date(...)` y
// después se formatean con toLocaleDateString, JavaScript las interpreta en
// UTC y luego las muestra en la zona horaria local (ej. Argentina, UTC-3),
// lo que le resta horas a la fecha y la hace "caer" al día anterior.
//
// Esta función arma la fecha usando los componentes año/mes/día directo del
// string, sin pasar por conversión de zona horaria, para que el día mostrado
// sea siempre el mismo que se guardó.
export function formatFecha(valor) {
  if (!valor) return "—";
  const soloFecha = String(valor).slice(0, 10); // "2026-07-15"
  const [anio, mes, dia] = soloFecha.split("-");
  if (!anio || !mes || !dia) return "—";
  return `${dia}/${mes}/${anio}`;
}

// Para inputs <input type="date">, que necesitan "YYYY-MM-DD" exacto.
export function toInputDate(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 10);
}
