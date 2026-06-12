import { useEffect, useState, type ReactNode } from "react";
import eigenIcon from "./assets/brand/eigen-icon.svg";
import eigenWordmark from "./assets/brand/eigen-wordmark.svg";

const APP_URL = "./app.html";

const GH = "https://github.com/zeeshan8281/eigen-tool-gate";
const VERIFY_TEE =
  "https://verify-sepolia.eigencloud.xyz/app/0x6f6FF0B640CD262d3120B91cEB146E97620272f9";
const EIGENCLOUD = "https://www.eigencloud.xyz";

/* =====================================================================
   "Verified Tool Gating" landing page.

   Identity: the GATE that STAMPS and SEALS every decision. The signature
   visual is the ALLOW=green / DENY=red duotone (the wax-stamp duality IS
   the brand); Eigen indigo is only a structural/secondary accent.

   Deliberately NOT the sibling's skeleton — no split-hero-with-terminal,
   no 4-up stats strip, no architecture SVG, no comparison table, no 6-up
   feature grid. Instead: centered stamping gate hero, a 74.6% → 0% stat,
   policy-as-artifact, a signed-receipt "passport stamp", sealed-vs-unsealed
   objection cards, and the live demo.
   ===================================================================== */

export default function App() {
  return (
    <div className="min-h-screen text-ink">
      <Nav />
      <main>
        <Hero />
        <BypassStat />
        <PolicyArtifact />
        <SignedReceipt />
        <HookObjection />
        <LiveDemoCTA />
        <ClosingCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ===================================================================== */
/* Shared bits                                                           */
/* ===================================================================== */
function Btn({
  children,
  href,
  variant = "solid",
  size = "md",
}: {
  children: ReactNode;
  href: string;
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "sm"
      ? "px-3 py-1.5 text-[13px]"
      : size === "lg"
        ? "px-5 py-2.5 text-[14px]"
        : "px-4 py-2 text-[13px]";
  const look =
    variant === "solid"
      ? "border border-pass/50 bg-pass/15 text-pass hover:bg-pass/25 shadow-[0_0_34px_-12px_rgba(52,211,153,0.8)]"
      : variant === "outline"
        ? "border border-white/15 bg-white/5 text-ink hover:border-white/30 hover:bg-white/10"
        : "text-ink-soft hover:text-ink";
  const cls = `inline-flex items-center justify-center gap-2 rounded font-semibold transition ${sz} ${look}`;
  return (
    <a
      href={href}
      className={cls}
      {...(href.startsWith("http")
        ? { target: "_blank", rel: "noreferrer" }
        : {})}
    >
      {children}
    </a>
  );
}

function SectionHead({
  id,
  eyebrow,
  title,
  lead,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-eigen-accent-soft">
        {eyebrow}
      </div>
      <h2 className="mt-3 max-w-3xl text-[27px] font-bold leading-[1.14] tracking-tight md:text-[36px]">
        {title}
      </h2>
      {lead && (
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {lead}
        </p>
      )}
    </div>
  );
}

/* A reusable little signature glyph — a scribbled secp256k1 "seal" mark. */
function SignatureGlyph({
  className = "",
  tone,
}: {
  className?: string;
  tone: "pass" | "deny";
}) {
  const stroke = tone === "pass" ? "#34d399" : "#f87171";
  return (
    <svg viewBox="0 0 56 20" className={className} aria-hidden>
      <path
        d="M2 14 C 8 4, 12 18, 17 9 S 24 2, 28 12 S 36 18, 41 7 C 45 0, 50 14, 54 8"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

/* ===================================================================== */
/* Nav                                                                   */
/* ===================================================================== */
function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-surface-0/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <a href="#top" className="flex items-center gap-3">
          <img src={eigenWordmark} alt="Eigen" className="h-5 w-auto" />
          <span className="text-ink-dim">/</span>
          <span className="text-[14px] font-medium">Tool Gating</span>
        </a>
        <div className="hidden items-center gap-7 text-[13px] text-ink-soft lg:flex">
          <a className="transition hover:text-ink" href="#policy">
            The policy
          </a>
          <a className="transition hover:text-ink" href="#receipt">
            The receipt
          </a>
          <a className="transition hover:text-ink" href="#hook">
            Not a hook
          </a>
          <a className="transition hover:text-ink" href={APP_URL}>
            Live demo
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Btn href={APP_URL} size="sm">
            See it live →
          </Btn>
          <Btn href={GH} variant="outline" size="sm">
            GitHub ★
          </Btn>
        </div>
      </nav>
    </header>
  );
}

/* ===================================================================== */
/* HERO — the stamping gate                                              */
/* ===================================================================== */
type GateItem = {
  tool: string;
  verdict: "ALLOW" | "DENY";
  reason?: string;
};

const GATE_CYCLE: GateItem[] = [
  { tool: "web_search", verdict: "ALLOW" },
  { tool: "file_write", verdict: "ALLOW" },
  { tool: "db_query · SELECT", verdict: "ALLOW" },
  { tool: "file_read /etc/passwd", verdict: "DENY", reason: "path" },
  { tool: "shell_exec", verdict: "DENY", reason: "blocked" },
  { tool: "file_delete", verdict: "DENY", reason: "needs approval" },
];

function StampingGate() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"enter" | "stamped">("enter");

  useEffect(() => {
    // chip enters, then the stamp slams down, then advance.
    setPhase("enter");
    const slam = setTimeout(() => setPhase("stamped"), 900);
    const next = setTimeout(() => setI((x) => (x + 1) % GATE_CYCLE.length), 2400);
    return () => {
      clearTimeout(slam);
      clearTimeout(next);
    };
  }, [i]);

  const item = GATE_CYCLE[i];
  const allow = item.verdict === "ALLOW";
  const tone = allow ? "pass" : "deny";
  const ring = allow
    ? "border-pass/60 text-pass"
    : "border-deny/60 text-deny";

  return (
    <div className="mx-auto w-full max-w-[640px]">
      {/* The gate housing */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-surface-1/70 px-5 py-7 shadow-[0_0_90px_-30px_rgba(99,102,241,0.5)] backdrop-blur-sm sm:px-8">
        {/* header rail */}
        <div className="mb-6 flex items-center justify-between font-mono text-[11px] text-ink-dim">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-eigen-accent-soft live-dot" />
            policy gate · inside the TEE
          </span>
          <span className="uppercase tracking-[0.18em]">deny-by-default</span>
        </div>

        {/* the conveyor: chip → gate slot → stamped verdict */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* incoming tool-call chip */}
          <div className="min-w-0 flex-1">
            <div
              key={`chip-${i}`}
              className="chip-enter inline-flex max-w-full items-center gap-2 rounded-md border border-eigen-accent/40 bg-eigen-accent/10 px-3 py-2.5"
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px] bg-eigen-accent-soft" />
              <span className="truncate font-mono text-[13px] text-ink">
                {item.tool}
              </span>
            </div>
            <div className="mt-2 pl-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim">
              tool call enters →
            </div>
          </div>

          {/* the gate doors */}
          <div className="relative flex h-[92px] w-[34px] shrink-0 items-stretch justify-center sm:w-[44px]">
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" />
            <div
              className={`gate-glow absolute inset-y-1 left-0 w-[6px] rounded-full ${allow ? "bg-pass/70" : "bg-deny/70"}`}
            />
            <div
              className={`gate-glow absolute inset-y-1 right-0 w-[6px] rounded-full ${allow ? "bg-pass/70" : "bg-deny/70"}`}
            />
          </div>

          {/* the stamped verdict */}
          <div className="relative min-w-0 flex-1">
            <div className="relative flex min-h-[92px] items-center justify-center">
              {phase === "stamped" && (
                <>
                  {/* ink press flash */}
                  <span
                    key={`ink-${i}`}
                    className={`ink-flash pointer-events-none absolute inset-0 rounded-full ${allow ? "bg-pass/30" : "bg-deny/30"} blur-md`}
                  />
                  {/* the wax stamp */}
                  <div
                    key={`stamp-${i}`}
                    className={`stamp-press relative flex flex-col items-center gap-1 rounded-lg border-2 border-dashed bg-surface-0/60 px-3.5 py-2.5 ${ring}`}
                  >
                    <span className="font-mono text-[15px] font-extrabold uppercase tracking-[0.14em]">
                      {item.verdict}
                    </span>
                    {item.reason && (
                      <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                        · {item.reason}
                      </span>
                    )}
                    <SignatureGlyph tone={tone} className="h-3 w-12" />
                  </div>
                </>
              )}
              {phase === "enter" && (
                <span className="font-mono text-[11px] text-ink-dim">
                  inspecting…
                </span>
              )}
            </div>
            <div className="mt-2 pr-1 text-right font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim">
              ← stamped &amp; signed
            </div>
          </div>
        </div>

        {/* footer line */}
        <div className="mt-6 border-t border-white/10 pt-4 text-center font-mono text-[11px] text-ink-dim">
          every verdict is sealed in the enclave{" "}
          <span className="text-ink-soft">before</span> the tool runs
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative mx-auto max-w-5xl px-5 pt-16 pb-12 text-center sm:px-6 md:pt-24"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-pass" />
        Built on EigenCompute · Intel TDX · verifiable
      </span>

      <h1 className="mx-auto mt-7 max-w-4xl text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[48px] md:text-[60px]">
        Your agent can only do
        <br className="hidden sm:block" /> what the policy{" "}
        <span className="text-pass">allows</span>.
        <br />
        <span className="text-ink-dim">And anyone can prove it.</span>
      </h1>

      <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
        Every tool call passes through one gate inside a verifiable enclave —
        and walks out with a stamp. A green{" "}
        <span className="font-semibold text-pass">ALLOW</span> or a red{" "}
        <span className="font-semibold text-deny">DENY</span>, signed and
        hash-chained, before the tool ever runs.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Btn href={APP_URL} size="lg">
          See it live →
        </Btn>
        <Btn href={GH} variant="outline" size="lg">
          GitHub
        </Btn>
      </div>

      <div className="mt-14">
        <StampingGate />
      </div>
    </section>
  );
}

/* ===================================================================== */
/* BYPASS STAT — 74.6% → 0%                                              */
/* ===================================================================== */
function BypassStat() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-6">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-surface-1/50">
        <div className="grid items-stretch gap-px bg-white/10 md:grid-cols-[1fr_auto_1fr]">
          {/* before */}
          <div className="bg-surface-1/60 p-7 text-center sm:p-9">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-deny">
              Alignment alone
            </div>
            <div className="mt-3 text-[58px] font-extrabold leading-none tracking-tight text-deny sm:text-[72px]">
              74.6%
            </div>
            <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              Frontier models are socially engineered into authorizing{" "}
              <span className="text-ink">fraudulent actions</span> three times
              out of four — on alignment alone.
            </p>
          </div>

          {/* arrow / gate divider */}
          <div className="flex items-center justify-center bg-surface-1/60 px-6 py-4">
            <div className="flex flex-col items-center gap-2">
              <span className="rounded-md border border-eigen-accent/40 bg-eigen-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-eigen-accent-soft">
                + policy gate
              </span>
              <span className="text-[26px] text-ink-dim">→</span>
            </div>
          </div>

          {/* after */}
          <div className="bg-surface-1/60 p-7 text-center sm:p-9">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-pass">
              Deterministic gate in front
            </div>
            <div className="mt-3 text-[58px] font-extrabold leading-none tracking-tight text-pass sm:text-[72px]">
              0%
            </div>
            <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              Bypass rate drops to zero across{" "}
              <span className="text-ink">879 attempts</span>. The gate doesn't
              get persuaded — it checks the rule and stamps the verdict.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 px-7 py-3.5 text-center font-mono text-[11px] text-ink-dim">
          don't ask the model to behave. put a gate in front that can't be
          talked out of it.
        </div>
      </div>
    </section>
  );
}

/* ===================================================================== */
/* POLICY AS ARTIFACT — read the YAML yourself                           */
/* ===================================================================== */
type PolicyLine = { text: string; tone?: "key" | "deny" | "pass" | "dim" };

const POLICY_LINES: PolicyLine[] = [
  { text: "defaults:" },
  { text: "  verdict: DENY", tone: "deny" }, // 1
  { text: "" },
  { text: "rules:" },
  { text: "  - tool: web_search" },
  { text: "    verdict: ALLOW", tone: "pass" },
  { text: "" },
  { text: "  - tool: db_query" },
  { text: "    verdict: ALLOW", tone: "pass" },
  { text: "    constraints:" },
  { text: "      allowed_sql: [SELECT]", tone: "key" }, // 10
  { text: "      max_rows: 100", tone: "dim" },
  { text: "" },
  { text: "  - tool: file_delete" },
  { text: "    verdict: ALLOW", tone: "pass" },
  { text: "    constraints:" },
  { text: "      require_hitl: true", tone: "key" }, // 16
  { text: "" },
  { text: "  - tool: shell_exec" },
  { text: "    verdict: DENY", tone: "deny" }, // 19
];

const POLICY_CALLOUTS: {
  lineIdx: number;
  label: string;
  body: string;
  tone: "pass" | "deny";
}[] = [
  {
    lineIdx: 1,
    label: "deny-by-default",
    body: "Anything not explicitly listed is DENIED. No silent allow.",
    tone: "deny",
  },
  {
    lineIdx: 10,
    label: "allowed_sql: [SELECT]",
    body: "SELECT runs; DROP TABLE / DELETE / UPDATE are denied — read-only by rule.",
    tone: "deny",
  },
  {
    lineIdx: 16,
    label: "require_hitl: true",
    body: "Deleting a file pauses for explicit human approval before it proceeds.",
    tone: "pass",
  },
  {
    lineIdx: 18,
    label: "shell_exec → DENY",
    body: "Arbitrary command execution is blocked outright, every time.",
    tone: "deny",
  },
];

function toneClass(tone?: PolicyLine["tone"]) {
  switch (tone) {
    case "pass":
      return "text-pass";
    case "deny":
      return "text-deny";
    case "key":
      return "text-eigen-accent-soft";
    case "dim":
      return "text-ink-dim";
    default:
      return "text-ink-soft";
  }
}

function PolicyArtifact() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionHead
        id="policy"
        eyebrow="The artifact"
        title={
          <>
            The policy is just YAML.{" "}
            <span className="text-ink-dim">Read it yourself.</span>
          </>
        }
        lead="No black box, no model deciding what's safe in the moment. The gate enforces a plain file a non-cryptographer can read — and its SHA-256 is sealed into the enclave attestation."
      />

      <div className="mt-9 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* the code panel */}
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 font-mono text-[11px] text-ink-dim">
            <span>demo-policy.yaml</span>
            <span className="text-eigen-accent-soft">enforced · hashed</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7]">
            {POLICY_LINES.map((l, idx) => {
              const flagged = POLICY_CALLOUTS.some((c) => c.lineIdx === idx);
              return (
                <div
                  key={idx}
                  className={`-mx-2 flex items-baseline gap-3 rounded px-2 ${
                    flagged ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <span className="w-5 shrink-0 select-none text-right text-[10px] text-ink-dim/60">
                    {idx + 1}
                  </span>
                  <span className={toneClass(l.tone)}>
                    {l.text || " "}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* the callouts mapping rules → outcomes */}
        <div className="flex flex-col gap-3.5">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            rule → what it actually denies
          </div>
          {POLICY_CALLOUTS.map((c) => {
            const isDeny = c.tone === "deny";
            return (
              <div
                key={c.label}
                className={`rounded-lg border bg-surface-1/50 p-4 ${
                  isDeny
                    ? "border-deny/30"
                    : "border-pass/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                      isDeny
                        ? "bg-deny/15 text-deny ring-1 ring-deny/30"
                        : "bg-pass/15 text-pass ring-1 ring-pass/30"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isDeny ? "bg-deny" : "bg-pass"}`}
                    />
                    {isDeny ? "denies" : "gates"}
                  </span>
                  <code className="font-mono text-[12.5px] text-ink">
                    {c.label}
                  </code>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                  {c.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ===================================================================== */
/* SIGNED RECEIPT — the PolicyDecision envelope as a passport stamp      */
/* ===================================================================== */
const RECEIPT_FIELDS: {
  key: string;
  value: string;
  note?: string;
  noteTone?: "pass" | "indigo";
}[] = [
  { key: "toolName", value: "file_read" },
  {
    key: "verdict",
    value: "DENY",
    note: "the stamp itself",
  },
  { key: "reasonCode", value: "PATH_BLOCKED", note: "/etc/** is off-limits" },
  {
    key: "policyHash",
    value: "sha256:9f2c…a71b",
    note: "ties it to the attested policy",
    noteTone: "indigo",
  },
  {
    key: "sequenceNumber",
    value: "#7",
    note: "its place in the chain",
    noteTone: "indigo",
  },
  {
    key: "prevDecisionHash",
    value: "0x4ad9…e02f",
    note: "chained to the decision before it",
    noteTone: "indigo",
  },
  {
    key: "signature",
    value: "0x8b1f…c3d4",
    note: "sealed by the enclave key — unforgeable",
    noteTone: "pass",
  },
];

function SignedReceipt() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionHead
        id="receipt"
        eyebrow="The proof"
        title="Every decision walks out as a signed receipt."
        lead="Not a log line you have to trust — a self-verifying envelope. The signature seals it inside the enclave, prevDecisionHash chains it to the last, and policyHash ties it to the attested policy. Tamper with one field and the whole chain fails to verify."
      />

      <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_0.78fr] lg:items-start">
        {/* the receipt / passport stamp */}
        <div className="relative">
          {/* perforated ticket */}
          <div className="relative overflow-hidden rounded-xl border border-white/12 bg-surface-1/70 shadow-[0_0_70px_-28px_rgba(52,211,153,0.5)]">
            {/* header band */}
            <div className="flex items-center justify-between border-b border-dashed border-white/15 bg-deny/[0.06] px-5 py-3.5">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                PolicyDecision · receipt
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-sm bg-deny/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-deny ring-1 ring-deny/30">
                <span className="h-1.5 w-1.5 rounded-full bg-deny" />
                DENY
              </div>
            </div>

            {/* fields */}
            <div className="divide-y divide-white/8 px-5">
              {RECEIPT_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="grid grid-cols-[120px_1fr] items-baseline gap-3 py-2.5 sm:grid-cols-[150px_1fr]"
                >
                  <span className="font-mono text-[11.5px] text-ink-dim">
                    {f.key}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <code
                      className={`font-mono text-[12.5px] ${
                        f.key === "verdict"
                          ? "font-bold text-deny"
                          : "text-ink"
                      }`}
                    >
                      {f.value}
                    </code>
                    {f.note && (
                      <span
                        className={`text-[11px] ${
                          f.noteTone === "pass"
                            ? "text-pass"
                            : f.noteTone === "indigo"
                              ? "text-eigen-accent-soft"
                              : "text-ink-dim"
                        }`}
                      >
                        ← {f.note}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* sealed footer with wax seal */}
            <div className="flex items-center justify-between border-t border-dashed border-white/15 bg-pass/[0.05] px-5 py-4">
              <div className="font-mono text-[10.5px] leading-relaxed text-ink-dim">
                written to the append-only chain
                <br />
                <span className="text-pass">before</span> the error is raised
              </div>
              {/* wax seal */}
              <div className="seal-float relative grid h-14 w-14 place-items-center rounded-full border-2 border-pass/60 bg-pass/15">
                <div className="absolute inset-1 rounded-full border border-dashed border-pass/40" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-pass">
                  TEE
                </span>
              </div>
            </div>
          </div>
          {/* perforation dots on the sides */}
          <div className="pointer-events-none absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-surface-0" />
          <div className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-surface-0" />
        </div>

        {/* what makes it tamper-proof */}
        <div className="flex flex-col gap-3.5">
          {[
            [
              "signature",
              "Signed by a secp256k1 key that lives only inside the enclave. The operator never holds it, so a verdict can't be forged after the fact.",
              "pass",
            ],
            [
              "prevDecisionHash",
              "Each receipt embeds the hash of the one before it. Remove or reorder a denial and the chain no longer links — verification flags exactly where.",
              "indigo",
            ],
            [
              "policyHash",
              "The SHA-256 of the exact policy is stamped on every receipt and sealed into the attestation. Swap in a weaker policy and the hash changes — verifiers notice.",
              "indigo",
            ],
          ].map(([t, b, tone]) => (
            <div
              key={t}
              className={`rounded-lg border bg-surface-1/50 p-4 ${
                tone === "pass" ? "border-pass/30" : "border-eigen-accent/30"
              }`}
            >
              <code
                className={`font-mono text-[12.5px] ${tone === "pass" ? "text-pass" : "text-eigen-accent-soft"}`}
              >
                {t}
              </code>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                {b}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===================================================================== */
/* HOOK OBJECTION — sealed vs unsealed stamps (NOT a table)              */
/* ===================================================================== */
function StampCard({
  sealed,
  title,
  subtitle,
  points,
}: {
  sealed: boolean;
  title: string;
  subtitle: string;
  points: string[];
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-surface-1/50 p-6 sm:p-7 ${
        sealed ? "border-pass/35" : "border-white/12"
      }`}
    >
      {/* the stamp impression in the corner */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 grid h-28 w-28 rotate-[-12deg] place-items-center rounded-full border-[3px] ${
          sealed ? "border-pass/50" : "border-deny/40 opacity-70"
        }`}
      >
        <span
          className={`text-center font-mono text-[10px] font-bold uppercase leading-tight tracking-[0.12em] ${
            sealed ? "text-pass" : "text-deny"
          }`}
        >
          {sealed ? (
            <>
              sealed
              <br />✓
            </>
          ) : (
            <>
              not
              <br />
              sealed
            </>
          )}
        </span>
        {!sealed && (
          <span className="absolute h-[3px] w-[120%] rotate-[24deg] bg-deny/50" />
        )}
      </div>

      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">
        {subtitle}
      </div>
      <h3
        className={`mt-2 max-w-[14ch] text-[20px] font-bold tracking-tight ${
          sealed ? "text-ink" : "text-ink-soft"
        }`}
      >
        {title}
      </h3>

      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[13.5px]">
            <span
              className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-[3px] text-[10px] font-bold ${
                sealed
                  ? "bg-pass/15 text-pass ring-1 ring-pass/30"
                  : "bg-deny/15 text-deny ring-1 ring-deny/30"
              }`}
            >
              {sealed ? "✓" : "✕"}
            </span>
            <span className={sealed ? "text-ink" : "text-ink-soft"}>{p}</span>
          </li>
        ))}
      </ul>

      <div
        className={`mt-6 inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${
          sealed
            ? "bg-pass/15 text-pass"
            : "bg-deny/10 text-deny line-through decoration-deny/60"
        }`}
      >
        {sealed ? "runs on proof" : "runs on trust"}
        {sealed && <SignatureGlyph tone="pass" className="h-3 w-9" />}
      </div>
    </div>
  );
}

function HookObjection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionHead
        id="hook"
        eyebrow={'"Isn\'t this just a before_tool_call hook?"'}
        title="A hook is a stamp anyone can forge. The gate is one sealed in the enclave."
        lead="Frameworks already let you intercept tool calls. But a userspace hook runs on infrastructure you have to trust — and leaves nothing behind to prove it ran, or ran honestly."
      />

      <div className="mt-9 grid gap-5 md:grid-cols-2">
        <StampCard
          sealed={false}
          subtitle="userspace hook"
          title="Runs on trust"
          points={[
            "Runs on infra the operator controls — patch it out or disable it.",
            "No artifact: nothing proves the denial ever happened.",
            "Swap in a weaker rule silently; no one downstream can tell.",
            "Auditing means trusting whatever the logs say.",
          ]}
        />
        <StampCard
          sealed
          subtitle="verified tool gate"
          title="Runs on proof"
          points={[
            "Measured into the attestation — the operator can't skip it.",
            "Every verdict is a signed, hash-chained receipt.",
            "Change the policy and its hash changes — verifiers notice.",
            "Re-verify every signature yourself, in the browser.",
          ]}
        />
      </div>
    </section>
  );
}

/* ===================================================================== */
/* LIVE DEMO                                                             */
/* ===================================================================== */
function LiveDemoCTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionHead
        id="demo"
        eyebrow="Live demo"
        title="Run a real agent. Watch the gate decide."
        lead="The live console is the real engine talking to the enclave over the same origin. Prompt the agent or run a scenario, then re-verify every signature yourself — denials, hash-chain, and all."
      />
      <div className="mt-9 flex flex-wrap items-center gap-4">
        <Btn href={APP_URL} size="lg">
          Open the live console →
        </Btn>
        <span className="font-mono text-[11px] text-ink-dim">
          opens the full interactive console
        </span>
      </div>
    </section>
  );
}

/* ===================================================================== */
/* CLOSING                                                               */
/* ===================================================================== */
function ClosingCTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-surface-1/60 px-6 py-16 text-center">
        {/* dual-tone glow */}
        <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-deny/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-pass/10 blur-3xl" />

        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-eigen-accent-soft">
            Verified Tool Gating
          </div>
          <h2 className="mt-4 max-w-2xl text-[30px] font-bold tracking-tight md:text-[40px]">
            Stop trusting that your agent behaved.{" "}
            <span className="text-pass">Prove it.</span>
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Btn href={APP_URL} size="lg">
              See it live →
            </Btn>
            <Btn href={GH} variant="outline" size="lg">
              GitHub
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================================================================== */
/* FOOTER                                                                */
/* ===================================================================== */
const FOOTER_LINKS: [string, [string, string][]][] = [
  [
    "Explore",
    [
      ["The policy", "#policy"],
      ["The receipt", "#receipt"],
      ["Not a hook", "#hook"],
      ["Live demo", APP_URL],
    ],
  ],
  [
    "Verify",
    [
      ["GitHub", GH],
      ["Verify the TEE →", VERIFY_TEE],
      ["EigenCloud →", EIGENCLOUD],
    ],
  ],
];

function Footer() {
  return (
    <footer className="mt-6 border-t border-white/10">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src={eigenIcon}
              alt="Eigen"
              className="h-7 w-auto text-eigen-accent-soft"
            />
            <span className="text-[17px] font-semibold">
              Verified Tool Gating
            </span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
            Verifiable, tamper-proof authorization for AI agents · part 4 of the
            EigenCloud Agent Observability series.
          </p>
        </div>
        {FOOTER_LINKS.map(([h, links]) => (
          <div key={h}>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">
              {h}
            </div>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a
                    className="text-ink/80 transition hover:text-ink"
                    href={href}
                    {...(href.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-6 font-mono text-[11px] text-ink-dim sm:px-6">
          <span className="text-pass">ALLOW</span>
          <span className="text-ink-dim/50">/</span>
          <span className="text-deny">DENY</span>
          <span className="text-ink-dim/50">·</span>
          <span>every tool call, stamped &amp; sealed</span>
          <span className="text-ink-dim/50">·</span>
          <span>Intel TDX · EigenCompute</span>
        </div>
      </div>
    </footer>
  );
}
