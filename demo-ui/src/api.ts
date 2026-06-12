import type {
  Attestation,
  Catalog,
  DecisionsResponse,
  ScenarioResponse,
  StepResult,
  TamperPreview,
  VerifyChainResponse,
} from "./types";

// Same-origin by default (dashboard is served BY the engine). Override with VITE_API_BASE.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function getText(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return await res.text();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => get<{ sessionId: string }>("/health"),
  attestation: () => get<Attestation>("/gate/attestation"),
  policy: () => getText("/gate/policy"),
  decisions: (sessionId: string) =>
    get<DecisionsResponse>(
      `/gate/decisions?session_id=${encodeURIComponent(sessionId)}`,
    ),
  verifyChain: (sessionId: string) =>
    get<VerifyChainResponse>(
      `/gate/verify-chain?session_id=${encodeURIComponent(sessionId)}`,
    ),
  catalog: () => get<Catalog>("/demo/catalog"),
  runScenario: (id: "a" | "b" | "c") =>
    post<ScenarioResponse>(`/demo/scenario/${id}`),
  call: (tool: string, args: unknown, hitlApproved?: boolean) =>
    post<StepResult>("/demo/call", { tool, args, hitlApproved }),
  tamperPreview: () => post<TamperPreview>("/demo/tamper-preview"),
};

export { BASE as API_BASE };
