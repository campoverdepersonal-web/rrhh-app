import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { employeesRouter } from "./routes/employees.js";
import { comentariosRouter } from "./routes/comentarios.js";
import { evaluacionesRouter } from "./routes/evaluaciones.js";
import { sancionesRouter } from "./routes/sanciones.js";
import { cursosRouter } from "./routes/cursos.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { comparativosRouter } from "./routes/dashboardComparativos.js";
import { authRouter } from "./routes/auth.js";
import { importarMasivoRouter } from "./routes/importarMasivo.js";
import { competenciasRouter } from "./routes/competencias.js";
import { importarEvaluacionesCompetenciasRouter } from "./routes/importarEvaluacionesCompetencias.js";
import { uniformesRouter, catalogoRouter } from "./routes/uniformes.js";
import { alertasRouter } from "./routes/alertas.js";
import { importarUniformesRouter } from "./routes/importarUniformes.js";
import { requireAuth } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

app.use("/api/employees", requireAuth, employeesRouter);
app.use("/api/employees", requireAuth, importarMasivoRouter);
app.use("/api/employees/:employeeId/comentarios", requireAuth, comentariosRouter);
app.use("/api/employees/:employeeId/evaluaciones", requireAuth, evaluacionesRouter);
app.use("/api/employees/:employeeId/sanciones", requireAuth, sancionesRouter);
app.use("/api/employees/:employeeId/cursos", requireAuth, cursosRouter);
app.use("/api/employees/:employeeId", requireAuth, uniformesRouter);
app.use("/api/employees", requireAuth, importarUniformesRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/dashboard", requireAuth, comparativosRouter);
app.use("/api/competencias", requireAuth, competenciasRouter);
app.use("/api/uniformes", requireAuth, catalogoRouter);
app.use("/api/alertas", requireAuth, alertasRouter);
app.use("/api/employees", requireAuth, importarEvaluacionesCompetenciasRouter);

app.use((req, res) => res.status(404).json({ error: "No encontrado" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API RRHH escuchando en http://localhost:${PORT}`);
});
