const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

let onUnauthorized = () => {};
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

function getToken() {
  return localStorage.getItem("rrhh_token");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    onUnauthorized();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

function post(path, data) {
  return request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
function put(path, data) {
  return request(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
function importarArchivo(path, file) {
  const formData = new FormData();
  formData.append("archivo", file);
  return request(path, { method: "POST", body: formData });
}

export const api = {
  // --- Autenticación ---
  login: async (email, password) => {
    const data = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("rrhh_token", data.token);
    localStorage.setItem("rrhh_usuario", JSON.stringify(data.usuario));
    return data.usuario;
  },
  logout: () => {
    localStorage.removeItem("rrhh_token");
    localStorage.removeItem("rrhh_usuario");
  },
  getUsuarioActual: () => {
    const raw = localStorage.getItem("rrhh_usuario");
    return raw ? JSON.parse(raw) : null;
  },
  hayToken: () => Boolean(getToken()),

  listUsuarios: () => request("/auth/usuarios"),
  crearUsuario: (data) => post("/auth/usuarios", data),
  actualizarUsuario: (id, data) => put(`/auth/usuarios/${id}`, data),

  // --- Empleados ---
  listEmployees: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/employees${qs ? `?${qs}` : ""}`);
  },
  getEmployee: (id) => request(`/employees/${id}`),
  createEmployee: (data) => post("/employees", data),
  eliminarEmpleado: (id) => request(`/employees/${id}`, { method: "DELETE" }),
  importarEmpleados: (file) => {
    const formData = new FormData();
    formData.append("archivo", file);
    return request("/employees/importar", { method: "POST", body: formData });
  },
  importarComentarios: (file) => importarArchivo("/employees/importar-comentarios", file),
  importarEvaluaciones: (file) => importarArchivo("/employees/importar-evaluaciones", file),
  importarSanciones: (file) => importarArchivo("/employees/importar-sanciones", file),
  importarCursos: (file) => importarArchivo("/employees/importar-cursos", file),
  registrarDecisionPeriodoPrueba: (id, data) => post(`/employees/${id}/periodo-prueba`, data),
  registrarCambioPuesto: (id, data) => post(`/employees/${id}/historial-puestos`, data),
  eliminarHistorialPuesto: (employeeId, historialId) => request(`/employees/${employeeId}/historial-puestos/${historialId}`, { method: "DELETE" }),

  listComentarios: (id) => request(`/employees/${id}/comentarios`),
  crearComentario: (id, data) => post(`/employees/${id}/comentarios`, data),
  actualizarComentario: (employeeId, comentarioId, data) => put(`/employees/${employeeId}/comentarios/${comentarioId}`, data),
  eliminarComentario: (employeeId, comentarioId) => request(`/employees/${employeeId}/comentarios/${comentarioId}`, { method: "DELETE" }),

  listEvaluaciones: (id) => request(`/employees/${id}/evaluaciones`),
  crearEvaluacion: (id, data) => post(`/employees/${id}/evaluaciones`, data),
  actualizarEvaluacion: (employeeId, evaluacionId, data) => put(`/employees/${employeeId}/evaluaciones/${evaluacionId}`, data),
  eliminarEvaluacion: (employeeId, evaluacionId) => request(`/employees/${employeeId}/evaluaciones/${evaluacionId}`, { method: "DELETE" }),

  listSanciones: (id) => request(`/employees/${id}/sanciones`),
  crearSancion: (id, data) => post(`/employees/${id}/sanciones`, data),
  actualizarSancion: (employeeId, sancionId, data) => put(`/employees/${employeeId}/sanciones/${sancionId}`, data),
  eliminarSancion: (employeeId, sancionId) => request(`/employees/${employeeId}/sanciones/${sancionId}`, { method: "DELETE" }),

  listCursos: (id) => request(`/employees/${id}/cursos`),
  crearCurso: (id, data) => post(`/employees/${id}/cursos`, data),
  actualizarCurso: (employeeId, cursoId, data) => put(`/employees/${employeeId}/cursos/${cursoId}`, data),
  eliminarCurso: (employeeId, cursoId) => request(`/employees/${employeeId}/cursos/${cursoId}`, { method: "DELETE" }),

  // --- Dashboards ---
  getDashboardRRHH: () => request("/dashboard/rrhh"),
  listPuestos: () => request("/dashboard/puestos"),
  getPuesto: (puesto) => request(`/dashboard/puestos/${encodeURIComponent(puesto)}`),
  listLugares: () => request("/dashboard/lugares"),
  getLugar: (lugar) => request(`/dashboard/lugares/${encodeURIComponent(lugar)}`),
};
