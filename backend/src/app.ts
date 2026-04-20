import express from "express";
import cors from "cors";
import operatorsRouter from "./routes/operators.js";
import salesRouter from "./routes/sales.js";
import dashboardRouter from "./routes/dashboard.js";

export function createApp() {
  const app = express();

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:5173", "http://localhost:4173"];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }));

  app.use(express.json());

  // Health
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Routes
  app.use("/api", operatorsRouter);
  app.use("/api", salesRouter);
  app.use("/api", dashboardRouter);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
