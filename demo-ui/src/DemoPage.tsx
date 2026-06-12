import Demo from "./Demo";

/** Inline Eigen mark so `currentColor` inherits the page's light text color
 *  (an <img> can't, which left it black/invisible on the dark bar). */
function EigenMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 26" className={className} fill="currentColor" aria-label="Eigen" role="img">
      <path d="M11.7281 12.7791H8.79615V18.6414H5.86346V1.05103H0V24.5061H5.86346V24.5042H8.79615V24.5061H11.7281V24.5042H17.5922V18.6414H11.7281V12.7791Z" />
      <path d="M20.5243 1.05103H17.5928V6.91449H20.5243V1.05103Z" />
      <path d="M14.6601 1.05103L8.91501 1.05164V3.98307H11.7281V12.7773H14.6601V12.7761H17.5922V6.91264H14.6601V1.05103Z" />
    </svg>
  );
}

/**
 * Thin full-page shell around the interactive <Demo/>. The landing page links
 * here ("Open the live console →"). The demo itself handles a sleeping backend
 * gracefully, so this page works even when the API is down.
 */
export default function DemoPage() {
  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-surface-0/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <EigenMark className="h-5 w-auto text-ink" />
            <span className="text-[13px] font-medium text-ink">
              Verified Tool Gating
            </span>
            <span className="text-ink-dim">·</span>
            <span className="font-mono text-[12px] text-ink-soft">
              Live Console
            </span>
          </div>
          <a
            href="./index.html"
            className="text-[13px] text-ink-soft transition hover:text-ink"
          >
            ← Back to overview
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <Demo />
      </main>
    </div>
  );
}
