import { bootstrapGate } from "./bootstrap.js";
import { createApiServer } from "./api/server.js";
import { getAttestation } from "./tee/attestation.js";

/**
 * HTTP entrypoint. Boots the gate and serves the verification API. The MCP
 * server (src/mcp/server.ts) attaches to the same gate instance when an agent
 * framework connects over a transport.
 */
async function main(): Promise<void> {
  const { gate, log, signer } = await bootstrapGate();
  const port = Number(process.env.PORT ?? 8080);

  const app = createApiServer({ gate, log, signer });
  app.listen(port, () => {
    const att = getAttestation(signer, gate.policyHash);
    console.log(`[eigen-tool-gate] listening on :${port}  mode=${signer.mode}`);
    console.log(`[eigen-tool-gate] agent=${gate.agentId} session=${gate.sessionId}`);
    console.log(`[eigen-tool-gate] policy=${gate.policyHash}`);
    console.log(`[eigen-tool-gate] tee_address=${att.teeAddress}`);
    console.log(`[eigen-tool-gate] GET /gate/attestation  GET /gate/verify-chain`);
  });

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      void log.close().finally(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("[eigen-tool-gate] fatal:", err);
  process.exit(1);
});
