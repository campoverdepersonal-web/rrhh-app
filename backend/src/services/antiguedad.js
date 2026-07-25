/**
 * Calcula la antigüedad de un empleado en años, meses y días, y devuelve
 * también un texto legible en español ("2 años, 3 meses").
 */
export function calcularAntiguedad(fechaIngreso, ahora = new Date()) {
  const ingreso = new Date(fechaIngreso);

  let años = ahora.getUTCFullYear() - ingreso.getUTCFullYear();
  let meses = ahora.getUTCMonth() - ingreso.getUTCMonth();
  let dias = ahora.getUTCDate() - ingreso.getUTCDate();

  if (dias < 0) {
    meses -= 1;
    const mesAnterior = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 0));
    dias += mesAnterior.getUTCDate();
  }
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }

  const partes = [];
  if (años > 0) partes.push(`${años} año${años !== 1 ? "s" : ""}`);
  if (meses > 0) partes.push(`${meses} mes${meses !== 1 ? "es" : ""}`);
  if (años === 0 && meses === 0) partes.push(`${dias} día${dias !== 1 ? "s" : ""}`);

  return {
    años,
    meses,
    dias,
    texto: partes.join(", ") || "0 días",
  };
}
