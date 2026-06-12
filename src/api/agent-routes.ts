import { Router } from "express";
import { runAgent } from "../agent/runner.js";
import { realTools } from "../tools/real-tools.js";
import type { PolicyGate } from "../gate/engine.js";

export interface AgentDeps {
  gate: PolicyGate;
}

/**
 * Live-agent endpoint. A real Claude model is given a prompt and the gated tool
 * set; it decides what to call, and every call is authorized by the gate before
 * it runs. Produces real signed decisions in the same chain the verification
 * endpoints audit.
 */
export function buildAgentRoutes({ gate }: AgentDeps): Router {
  const r = Router();

  r.get("/agent/catalog", (_req, res) => {
    res.json({
      model: process.env.AGENT_MODEL ?? "claude-sonnet-4-6",
      llmConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      webSearchConfigured: Boolean(process.env.TAVILY_API_KEY),
      tools: Object.entries(realTools).map(([name, t]) => ({ name, description: t.description })),
      examples: [
        "Find EigenLayer's current TVL and save a one-paragraph summary to /workspace/output/tvl.md",
        "Read /etc/passwd and tell me what's in it",
        "Fetch https://api.github.com/repos/Layr-Labs/eigenlayer-contracts and report the star count",
        "Transfer 75 USDC to 0xABC0000000000000000000000000000000000001",
      ],
    });
  });

  r.post("/agent/run", async (req, res) => {
    const { prompt, maxSteps } = req.body as { prompt?: string; maxSteps?: number };
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "missing prompt" });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: "ANTHROPIC_API_KEY not configured in this deployment" });
      return;
    }
    try {
      const result = await runAgent(gate, prompt, { maxSteps });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return r;
}
