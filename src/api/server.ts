import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { RouteDeps } from "./routes.js";
import { buildRoutes } from "./routes.js";
import { buildDemoRoutes } from "./demo-routes.js";
import { buildAgentRoutes } from "./agent-routes.js";

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
  app.use(buildDemoRoutes(deps));
  app.use(buildAgentRoutes({ gate: deps.gate }));

  // Serve the built dashboard (demo-ui/dist) from the same port, if present.
  // In the TEE image this directory is baked in; locally it appears after
  // `npm --prefix demo-ui run build`.
  const uiDir = resolveUiDir();
  if (uiDir) {
    app.use(express.static(uiDir));
    app.get("*", (req, res, next) => {
      if (
        req.path.startsWith("/gate") ||
        req.path.startsWith("/demo") ||
        req.path.startsWith("/agent") ||
        req.path === "/health"
      ) {
        next();
        return;
      }
      res.sendFile(join(uiDir, "index.html"));
    });
  }

  // Final safety net: turn any escaped async error into a 500 instead of an
  // unhandled rejection that could crash the process.
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[eigen-tool-gate] route error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });

  return app;
}

function resolveUiDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../public"), // baked into the image (dist/../public)
    join(here, "../../demo-ui/dist"), // local dev from dist/
    join(process.cwd(), "demo-ui/dist"),
    join(process.cwd(), "public"),
  ];
  return candidates.find((p) => existsSync(join(p, "index.html"))) ?? null;
}
