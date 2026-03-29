"use client";

import LandingBearScene from "./landing-bear-scene";
import LandingWaterfallScene from "./landing-waterfall-scene";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function formatCurrency(amountInPaise: number) {
  return money.format(amountInPaise / 100);
}

interface FnbLandingProps {
  onSignIn: () => void;
}

export default function FnbLanding({ onSignIn }: FnbLandingProps) {
  return (
    <main className="shell landing-shell">
      {/* Waterfall lives OUTSIDE the filtered side-panel so position:fixed works */}
      <LandingWaterfallScene />

      <div aria-hidden="true" className="landing-world">
        <div className="landing-world-side landing-world-left">
          <LandingBearScene />
        </div>
      </div>

      <section className="hero landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">F&B</p>
          <h1 className="landing-title">
            <span>Track</span>
            <span>shared</span>
            <span>money</span>
            <span>without</span>
            <span>making</span>
            <span>friendships</span>
            <span>awkward.</span>
          </h1>
          <p className="lede">
            F&B keeps every split, payback, and approval in one place so both
            sides always see the same story.
          </p>

          <div className="landing-cta-stack">
            <button
              className="primary-button landing-google-button"
              onClick={onSignIn}
              type="button"
            >
              Continue with Google
            </button>
            <div className="landing-inline-features">
              <span>Stable cross-platform</span>
              <span className="dot-separator">•</span>
              <span>Fast sign in</span>
              <span className="dot-separator">•</span>
              <span>No sync</span>
            </div>
          </div>
        </div>

        <div className="landing-preview-layered-snapshot">
          {/* Dominant approval surface */}
          <article className="layered-card dominant-card">
            <div className="landing-preview-focus-copy">
              <span className="label">Pending approval</span>
              <strong>Cab ride home</strong>
              <p>
                Arjun logged tonight&apos;s ride. Review it before it lands in the balance.
              </p>
            </div>
            <div className="landing-preview-focus-side">
              <span className="amount-badge neutral">{formatCurrency(46000)}</span>
              <div className="landing-preview-decision-row">
                <span className="landing-preview-decision landing-preview-decision-approve">Approve</span>
                <span className="landing-preview-decision landing-preview-decision-reject">Reject</span>
              </div>
            </div>
          </article>

          {/* Overlapping balance accent */}
          <article className="layered-card balance-card">
            <span className="label">Live balance</span>
            <strong>You are up {formatCurrency(124000)}</strong>
            <div className="landing-preview-balance-bar">
              <span className="landing-preview-balance-fill" />
            </div>
          </article>

          {/* Short activity shelf */}
          <article className="layered-card activity-card">
            <div className="activity-row">
              <div className="avatar micro avatar-n">N</div>
              <div className="activity-info">
                <strong>Dinner split</strong>
                <span>Neha owes you</span>
              </div>
              <span className="pill status-pending">pending</span>
            </div>
          </article>
        </div>
      </section>

      <div className="landing-scroll-cue">
        <span className="landing-scroll-dot" />
        Scroll the flow
      </div>

      <section className="landing-grid">
        <article className="panel landing-panel landing-story-panel">
          <div className="section-head landing-section-head">
            <div>
              <p className="eyebrow">How it flows</p>
              <h2>From &ldquo;who paid?&rdquo; to settled — in three calm beats.</h2>
              <p className="muted landing-panel-lede">
                No spreadsheets, no group-chat math. Every expense flows through
                a clear pipeline until both sides agree.
              </p>
            </div>
          </div>

          <div className="landing-feature-list">
            <div className="landing-feature-item">
              <span className="landing-feature-step">01</span>
              <div>
                <strong>Connect by username</strong>
                <p>Find your friend in one search — no phone contacts, no social accounts. Just a clean, private link.</p>
              </div>
            </div>
            <div className="landing-feature-item">
              <span className="landing-feature-step">02</span>
              <div>
                <strong>Log &amp; approve together</strong>
                <p>Either side can log an expense. It only becomes real once the other person approves — no surprises, no disputes.</p>
              </div>
            </div>
            <div className="landing-feature-item">
              <span className="landing-feature-step">03</span>
              <div>
                <strong>Settle &amp; close</strong>
                <p>When money moves, record it. The balance resets cleanly and the history stays for both sides forever.</p>
              </div>
            </div>
          </div>
        </article>

        <article className="panel landing-panel landing-panel-soft landing-proof-panel">
          <div className="section-head landing-section-head">
            <div>
              <p className="eyebrow">Built to stay calm</p>
              <h2>A dashboard that shows the truth — nothing more.</h2>
              <p className="muted landing-panel-lede">
                Every screen is designed to reduce anxiety, not add to it.
                Clear numbers, honest statuses, zero noise.
              </p>
            </div>
          </div>

          <div className="landing-check-grid">
            <div className="landing-check-card">
              <strong>Zero-jump layout</strong>
              <p>All actions happen in dialogs. The page below never moves, scrolls, or re-renders unexpectedly.</p>
            </div>
            <div className="landing-check-card">
              <strong>Dual-consent system</strong>
              <p>No one-sided edits. Every change needs both parties to agree before it touches the balance.</p>
            </div>
            <div className="landing-check-card">
              <strong>Real-time sync</strong>
              <p>Changes appear instantly on both sides. No refresh button, no &ldquo;pull to update&rdquo; — it just works.</p>
            </div>
            <div className="landing-check-card">
              <strong>Private by default</strong>
              <p>Only you and your friend see the balance. No leaderboards, no social feeds, no data selling.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
