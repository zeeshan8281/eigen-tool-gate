import express from "express";
import type { RouteDeps } from "./routes.js";
import { buildRoutes } from "./routes.js";

export function createApiServer(deps: RouteDeps): express.Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    next();
  });
  app.use(buildRoutes(deps));
  return app;
}
