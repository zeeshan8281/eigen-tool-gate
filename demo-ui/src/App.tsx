import { useEffect, useState, type ReactNode } from "react";
import eigenIcon from "./assets/brand/eigen-icon.svg";
import eigenWordmark from "./assets/brand/eigen-wordmark.svg";
import Demo from "./Demo";

const GH = "https://github.com/zeeshan8281/eigen-tool-gate";
const THREAT_MODEL = `${GH}#threat-model-summary`;
const README = `${GH}#readme`;
const VERIFY_TEE =
  "https://verify-sepolia.eigencloud.xyz/app/0x6f6FF0B640CD262d3120B91cEB146E97620272f9";
const EIGENCLOUD = "https://www.eigencloud.xyz";

export default function App() {
  return (
    <div className="min-h-screen text-ink">
      <Nav />
      <main className="mx-auto max-w-6xl px-5 sm:px-6">
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <NotAHook />
        <Features />
        <LiveDemoSection />
        <ClosingCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ===================================================================== */
/* Reusable bits                                                          */
/* ===================================================================== */
function Btn({
  children,
  href,
  variant = "solid",
  size = "md",
  onClick,
}: {
  children: ReactNode;
  href?: string;
  variant?: "solid" | "outline";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}) {
  const sz =
    size === "sm"
      ? "px-3 py-1.5 text-[13px]"
      : size === "lg"
        ? "px-5 py-2.5 text-[14px]"
        : "px-4 py-2 text-[13px]";
  const look =
    variant === "solid"
      ? "border border-eigen-accent/60 bg-eigen-accent/20 text-eigen-accent-soft hover:bg-eigen-accent/30 shadow-[0_0_30px_-10px_rgba(99,102,241,0.7)]"
      : "border border-white/15 bg-white/5 text-ink hover:border-white/25 hover:bg-white/10";
  const cls = `inline-flex items-center justify-center gap-2 rounded font-semibold transition ${sz} ${look}`;
  if (href)
    return (
      <a
        href={href}
        className={cls}
        {...(href.startsWith("http")
          ? { target: "_blank", rel: "noreferrer" }
          : {})}
        onClick={onClick}
      >
        {children}
      </a>
    );
  return (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-eigen-accent-soft">
      {children}
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  lead,
  children,
}: {
  id?: string;
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-16 md:py-20">
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-3 max-w-3xl text-[28px] font-bold leading-[1.12] tracking-tight md:text-[36px]">
        {title}
      </h2>
      {lead && (
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {lead}
        </p>
      )}
      <div className="mt-9">{children}</div>
    </section>
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
          <a className="transition hover:text-ink" href="#how">
            How it works
          </a>
          <a className="transition hover:text-ink" href="#why">
            Not just a hook
          </a>
          <a className="transition hover:text-ink" href="#demo">
            Live demo
          </a>
          <a
            className="transition hover:text-ink"
            href={GH}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Btn href="#demo" size="sm">
            Open demo →
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
/* Hero                                                                  */
/* ===================================================================== */
type FeedLine = { text: string; cls?: string; tail?: string; tailCls?: string };

const HERO_FEED: FeedLine[] = [
  { text: 'you → agent', tail: '"research EigenLayer, then clean up old files"', tailCls: "text-ink" },
  { text: "agent → web_search", tail: "ALLOW", tailCls: "text-pass" },
  { text: "agent → file_write", tail: "ALLOW", tailCls: "text-pass" },
  { text: "agent → db_query (SELECT)", tail: "ALLOW", tailCls: "text-pass" },
  { text: "agent → file_read /etc/passwd", tail: "DENY · path", tailCls: "text-deny" },
  { text: "agent → shell_exec", tail: "DENY · blocked", tailCls: "text-deny" },
  { text: "agent → file_delete", tail: "DENY · needs human approval", tailCls: "text-deny" },
  { text: "# every decision signed in the enclave, before the tool runs", cls: "text-ink-dim" },
];

function HeroFeed() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= HERO_FEED.length) {
      const t = setTimeout(() => setN(0), 4200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : 520);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <div className="rounded-lg border border-white/10 bg-surface-1/70 shadow-[0_0_60px_-20px_rgba(99,102,241,0.5)] backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 font-mono text-[11px] text-ink-dim">
        <span>live feed · policy gate</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-eigen-accent-soft live-dot" />
          inside the TEE
        </span>
      </div>
      <div className="min-h-[300px] space-y-2 p-4 font-mono text-[12.5px] leading-relaxed">
        {HERO_FEED.slice(0, n).map((l, i) => (
          <div key={i} className="row-in flex flex-wrap items-baseline gap-x-2">
            <span className={l.cls ?? "text-ink-soft"}>{l.text}</span>
            {l.tail && (
              <span className={`font-semibold ${l.tailCls ?? "text-ink"}`}>
                {l.tail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="grid items-center gap-12 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24"
    >
      <div>
        <span className="inline-flex rounded border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-ink-soft">
          Built on EigenCompute · Intel TDX TEE · verifiable
        </span>
        <h1 className="mt-6 text-[40px] font-bold leading-[1.04] tracking-tight md:text-[58px]">
          Your agent can only do
          <br />
          what the policy allows.
          <br />
          <span className="text-ink-dim">And anyone can prove it.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          Every tool call is intercepted inside a verifiable{" "}
          <span className="font-medium text-ink">Intel TDX enclave</span>. Every{" "}
          <span className="font-medium text-pass">ALLOW</span> and{" "}
          <span className="font-medium text-deny">DENY</span> is{" "}
          <span className="font-medium text-ink">signed and hash-chained</span>{" "}
          before the tool runs. The operator can't disable the gate, the agent
          can't hide a denial, and you can{" "}
          <span className="font-medium text-ink">
            re-verify the whole history yourself
          </span>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Btn href="#demo" size="lg">
            See it live →
          </Btn>
          <Btn href={THREAT_MODEL} variant="outline" size="lg">
            Read the threat model
          </Btn>
        </div>
      </div>
      <HeroFeed />
    </section>
  );
}

/* ===================================================================== */
/* Stats strip                                                           */
/* ===================================================================== */
const STATS: [string, string][] = [
  ["TDX", "hardware enclave · every decision signed"],
  ["0", "ways for the operator to skip the gate"],
  ["1", "policy hash · sealed into the attestation"],
  ["100%", "of denials persisted before the error is raised"],
];

function StatsStrip() {
  return (
    <section className="pb-2">
      <div className="grid grid-cols-2 divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-surface-1/60 md:grid-cols-4 md:divide-x">
        {STATS.map(([n, l]) => (
          <div key={l} className="border-t border-white/10 px-6 py-6 text-center first:border-t-0 md:border-t-0">
            <div className="text-[30px] font-bold tracking-tight text-eigen-accent-soft md:text-[38px]">
              {n}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              {l}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================================================================== */
/* How it works + Architecture SVG                                       */
/* ===================================================================== */
function GateArchitectureSVG() {
  return (
    <svg
      viewBox="0 0 820 460"
      className="w-full"
      role="img"
      aria-label="Verified Tool Gating architecture"
    >
      <defs>
        <marker id="g-ah" markerWidth="9" markerHeight="9" refX="5" refY="4.5" orient="auto">
          <path d="M1 1 L8 4.5 L1 8 Z" fill="currentColor" />
        </marker>
        <radialGradient id="g-glow" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.22" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* enclave boundary */}
      <rect x="208" y="40" width="404" height="306" rx="16" fill="url(#g-glow)" stroke="#6366f1" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="6 5" />
      <text x="230" y="66" fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="2" fill="#818cf8">
        INTEL TDX ENCLAVE · EIGENCOMPUTE
      </text>

      {/* agent */}
      <g>
        <rect x="24" y="150" width="132" height="56" rx="12" fill="#141417" stroke="#818cf8" strokeOpacity="0.5" />
        <circle cx="52" cy="178" r="5" fill="#818cf8" />
        <text x="68" y="183" fontFamily="ui-monospace, monospace" fontSize="14" fill="#ededef">agent</text>
        <text x="24" y="232" fontFamily="ui-monospace, monospace" fontSize="10.5" fill="#737373">a real Claude model</text>
      </g>

      {/* agent -> gate */}
      <g style={{ color: "#818cf8" }}>
        <line x1="156" y1="178" x2="280" y2="178" stroke="#818cf8" strokeOpacity="0.7" strokeWidth="1.6" markerEnd="url(#g-ah)" />
        <text x="170" y="168" fontFamily="ui-monospace, monospace" fontSize="10.5" fill="#a3a3a3">tool call</text>
      </g>

      {/* the gate */}
      <rect x="282" y="138" width="148" height="80" rx="12" fill="#171717" stroke="#6366f1" strokeOpacity="0.8" strokeWidth="1.6" />
      <text x="356" y="170" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="600" fill="#fafafa">Policy Gate</text>
      <text x="356" y="190" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fill="#a3a3a3">deny-by-default</text>
      <text x="356" y="206" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fill="#a3a3a3">in-process interceptor</text>

      {/* gate -> allow -> tool */}
      <g style={{ color: "#34d399" }}>
        <line x1="430" y1="160" x2="556" y2="118" stroke="#34d399" strokeOpacity="0.75" strokeWidth="1.6" markerEnd="url(#g-ah)" />
        <text x="452" y="128" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="600" fill="#34d399">ALLOW</text>
      </g>
      <rect x="556" y="92" width="120" height="48" rx="10" fill="#141417" stroke="#34d399" strokeOpacity="0.45" />
      <text x="616" y="121" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12" fill="#ededef">real tool</text>

      {/* gate -> deny -> blocked */}
      <g style={{ color: "#f87171" }}>
        <line x1="430" y1="196" x2="556" y2="238" stroke="#f87171" strokeOpacity="0.75" strokeWidth="1.6" markerEnd="url(#g-ah)" />
        <text x="452" y="234" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="600" fill="#f87171">DENY</text>
      </g>
      <rect x="556" y="214" width="120" height="48" rx="10" fill="#141417" stroke="#f87171" strokeOpacity="0.45" />
      <text x="616" y="243" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12" fill="#ededef">blocked</text>

      {/* gate -> signed log (writes BEFORE verdict takes effect) */}
      <g style={{ color: "#818cf8" }}>
        <line x1="356" y1="218" x2="356" y2="286" stroke="#818cf8" strokeOpacity="0.6" strokeWidth="1.6" markerEnd="url(#g-ah)" />
      </g>
      <rect x="244" y="288" width="324" height="44" rx="10" fill="#171717" stroke="#ffffff1a" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={262 + i * 58} y="300" width="44" height="20" rx="4" fill={i % 2 ? "#6366f1" : "#312e81"} fillOpacity={i % 2 ? 0.55 : 0.75} />
      ))}
      <text x="406" y="356" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10.5" fill="#a3a3a3">
        signed hash-chained log · written before the verdict takes effect
      </text>

      {/* policy -> sha256 -> attestation */}
      <g style={{ color: "#737373" }}>
        <rect x="24" y="404" width="150" height="38" rx="8" fill="#141417" stroke="#ffffff14" />
        <text x="99" y="428" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11.5" fill="#ededef">policy.yaml</text>
        <line x1="174" y1="423" x2="246" y2="423" stroke="#737373" strokeOpacity="0.7" strokeWidth="1.4" markerEnd="url(#g-ah)" />
        <text x="180" y="414" fontFamily="ui-monospace, monospace" fontSize="10" fill="#818cf8">sha256</text>
        <rect x="248" y="404" width="150" height="38" rx="8" fill="#141417" stroke="#6366f1" strokeOpacity="0.4" />
        <text x="323" y="428" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11.5" fill="#ededef">attestation</text>
        <text x="412" y="428" fontFamily="ui-monospace, monospace" fontSize="10.5" fill="#737373">← anyone can re-check the hash</text>
      </g>
    </svg>
  );
}

function HowItWorks() {
  return (
    <Section
      id="how"
      kicker="How it works"
      title="One gate. Every tool call passes through it. Nothing gets around it."
      lead="The gate is an in-process interceptor inside the enclave — not a sidecar the agent can route around. Each call is matched against a deny-by-default policy, signed, and written to an append-only hash-chained log before the verdict takes effect."
    >
      <div className="overflow-hidden rounded-lg border border-white/10 bg-surface-1/60 p-6 md:p-8">
        <GateArchitectureSVG />
      </div>
    </Section>
  );
}

/* ===================================================================== */
/* Not just a hook — comparison table                                    */
/* ===================================================================== */
const COMPARE: [string, string, string][] = [
  ["Where it runs", "your app, on infra you trust", "inside an attested Intel TDX enclave"],
  ["Operator can skip it", "yes — patch it out or disable it", "no — it's measured into the attestation"],
  ["Proof a denial happened", "none", "signed, hash-chained, persisted before the error"],
  ["Swap in a weaker policy", "silent", "changes the attestation hash — verifiers notice"],
  ["Audit after the fact", "trust the logs", "re-verify every signature yourself"],
];

function NotAHook() {
  return (
    <Section
      id="why"
      kicker={'"Isn\'t this just a before_tool_call hook?"'}
      title="A hook runs on trust. A gate runs on proof."
      lead="Frameworks already have tool-call hooks. They run in userspace on infrastructure you have to trust — and there's no proof they ran."
    >
      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="grid grid-cols-[0.85fr_1fr_1fr] border-b border-white/10 bg-surface-1/60 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
          <div className="px-4 py-3 sm:px-5"> </div>
          <div className="px-4 py-3 sm:px-5">Userspace hook</div>
          <div className="border-l border-white/10 px-4 py-3 text-eigen-accent-soft sm:px-5">
            Verified Tool Gating
          </div>
        </div>
        {COMPARE.map(([label, hook, gate], i) => (
          <div
            key={label}
            className={`grid grid-cols-[0.85fr_1fr_1fr] text-[13px] ${
              i < COMPARE.length - 1 ? "border-b border-white/10" : ""
            }`}
          >
            <div className="px-4 py-3.5 font-medium text-ink/90 sm:px-5">
              {label}
            </div>
            <div className="px-4 py-3.5 text-ink-soft sm:px-5">{hook}</div>
            <div className="border-l border-white/10 px-4 py-3.5 text-ink sm:px-5">
              {gate}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===================================================================== */
/* Features                                                              */
/* ===================================================================== */
const FEATURES: [string, string][] = [
  ["Deny-by-default policy", "Plain YAML a non-cryptographer can read. Anything not explicitly allowed is blocked."],
  ["Runs in an Intel TDX TEE", "The gate is compiled into the enclave image; the signing key is sealed and never leaves."],
  ["Signed, hash-chained decisions", "Every ALLOW and DENY is secp256k1-signed and linked to the last — tamper-evident."],
  ["A real agent, real tools", "A live Claude model calls real tools — web search, files, SQL — each one gated before it runs."],
  ["Human-in-the-loop", "Destructive actions like file deletion require explicit human approval to proceed."],
  ["Verify it yourself", "Re-check every signature and the whole chain in your browser. No trust in the server."],
];

function Features() {
  return (
    <Section kicker="What you get" title="A gate you can prove, not a hook you hope ran.">
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map(([t, b]) => (
          <div
            key={t}
            className="rounded-lg border border-white/10 bg-surface-1/60 p-6 transition hover:border-eigen-accent/40"
          >
            <h3 className="text-[15px] font-semibold">{t}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===================================================================== */
/* Live demo section                                                     */
/* ===================================================================== */
function LiveDemoSection() {
  return (
    <Section
      id="demo"
      kicker="Live demo"
      title="Run a real agent. Watch the gate decide."
      lead="This is the real engine — talking to the live enclave over the same origin. Run a scenario or prompt the agent, then re-verify every signature yourself."
    >
      <div className="rounded-lg border border-white/10 bg-surface-1/40 p-4 sm:p-6">
        <Demo />
      </div>
    </Section>
  );
}

/* ===================================================================== */
/* Closing CTA                                                           */
/* ===================================================================== */
function ClosingCTA() {
  return (
    <section className="py-20">
      <div className="flex flex-col items-center rounded-lg border border-white/10 bg-surface-1/60 px-8 py-16 text-center shadow-[0_0_80px_-30px_rgba(99,102,241,0.6)]">
        <Kicker>Verified Tool Gating</Kicker>
        <h2 className="mt-4 max-w-2xl text-[30px] font-bold tracking-tight md:text-[38px]">
          Stop trusting that your agent behaved.{" "}
          <span className="text-ink-dim">Prove it.</span>
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Btn href="#demo" size="lg">
            Open the live demo →
          </Btn>
          <Btn href={GH} variant="outline" size="lg">
            GitHub
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* ===================================================================== */
/* Footer                                                                */
/* ===================================================================== */
const FOOTER: [string, [string, string][]][] = [
  ["Product", [["How it works", "#how"], ["Not just a hook", "#why"], ["Live demo", "#demo"]]],
  ["Developers", [["GitHub", GH], ["README", README]]],
  ["More", [["Verify the TEE →", VERIFY_TEE], ["EigenCloud →", EIGENCLOUD]]],
];

function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <img src={eigenIcon} alt="Eigen" className="h-7 w-auto text-eigen-accent-soft" />
            <span className="text-[17px] font-semibold">Verified Tool Gating</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
            Verifiable, tamper-proof authorization for AI agents — part 4 of the
            EigenCloud Agent Observability series.
          </p>
        </div>
        {FOOTER.map(([h, links]) => (
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
        <div className="mx-auto max-w-6xl px-5 py-6 font-mono text-[11px] text-ink-dim sm:px-6">
          Verified Tool Gating · Intel TDX · EigenCompute · every tool call,
          gated
        </div>
      </div>
    </footer>
  );
}
