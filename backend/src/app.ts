import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import managerRouter from "./routes/manager.js";
import operatorRouter from "./routes/operator.js";
import archiveRouter from "./routes/archive.js";
import importRouter from "./routes/import.js";

export function createApp() {
  const app = express();

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:5173", "http://localhost:4173"];

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) cb(null, true);
      else cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  }));

  app.use(express.json());

  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api", authRouter);
  app.use("/api", adminRouter);
  app.use("/api", managerRouter);
  app.use("/api", operatorRouter);
  app.use("/api", archiveRouter);
  app.use("/api", importRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
