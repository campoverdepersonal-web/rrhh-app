// Cortes documentados en la especificación de Nine Box de Campo Verde.

export function nivelDesempeno(puntaje0a100) {
  if (puntaje0a100 == null) return null;
  const p = Number(puntaje0a100);
  if (p < 60) return "Bajo";
  if (p < 85) return "Medio";
  return "Alto";
}

export function nivelPotencial(promedio1a4) {
  if (promedio1a4 == null) return null;
  const p = Number(promedio1a4);
  if (p <= 2) return "Bajo";
  if (p <= 3) return "Medio";
  return "Alto";
}
