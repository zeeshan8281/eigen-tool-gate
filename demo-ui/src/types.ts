export type Verdict = "ALLOW" | "DENY";

export interface Attestation {
  mode: "tee" | "dev";
  teePublicKey?: string;
  teeAddress?: string;
  policyHash?: string;
  imageDigest?: string;
  eigenComputeDeploymentId?: string;
  kmsKeyFingerprint?: string;
  platform?: string;
  verifyUrl?: string;
}

export interface PolicyDecision {
  decisionId: string;
  toolName: string;
  toolArgsHash: string;
  policyHash: string;
  verdict: Verdict;
  reasonCode: string;
  constraintDetails?: string;
  timestamp: string;
  sessionId: string;
  agentId: string;
  sequenceNumber: number;
  prevDecisionHash: string;
  signature: string;
}

export interface DecisionsResponse {
  sessionId: string;
  count: number;
  decisions: PolicyDecision[];
}

export interface VerifyChainResponse {
  valid: boolean;
  chainLength: number;
  allowCount: number;
  denyCount: number;
  gaps: number[];
  brokenAt: number | null;
  errors: string[];
}

export interface CatalogTool {
  name: string;
  description: string;
}

export interface Catalog {
  tools: CatalogTool[];
  adversarial: { label: string; tool: string }[];
  scenarios: { id: string; title: string; verdictHint?: string }[];
}

export interface StepResult {
  tool: string;
  args?: unknown;
  verdict: Verdict;
  decisionId?: string;
  reasonCode?: string;
  message?: string;
  result?: unknown;
}

export interface ScenarioResponse {
  scenario: string;
  steps: StepResult[];
}

export interface TamperPreview {
  tamperedSequence: number;
  flippedFrom: Verdict;
  flippedTo: Verdict;
  before: { valid: boolean };
  after: { valid: boolean; brokenAt: number | null; error: string };
}
