import eigenIcon from "./assets/brand/eigen-icon.svg";
import Demo from "./Demo";

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
            <img
              src={eigenIcon}
              alt="Eigen"
              className="h-5 w-auto text-eigen-accent-soft"
            />
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
