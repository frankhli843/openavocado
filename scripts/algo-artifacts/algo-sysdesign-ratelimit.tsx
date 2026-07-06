import { useState } from "react";

/**
 * Walks the TOKEN BUCKET rate limiter over time on a single timeline.
 * A bucket holds up to CAPACITY tokens and refills at REFILL_RATE tokens/second.
 * Each request costs one token and is allowed only when a token is available.
 * We show a burst that drains the bucket to empty (some requests rejected), then
 * a lazy refill computed as min(capacity, tokens + elapsed * rate) on the next
 * request — no background timer required. The final step contrasts the token
 * bucket with a sliding window counter so the burst-vs-strict tradeoff is clear.
 * All token counts are precomputed deterministically; nothing is random.
 */

const CAPACITY = 5;
const REFILL_RATE = 1; // token per second

type Req = { id: number; allowed: boolean };
type Frame = {
  time: string;
  tokens: number; // tokens remaining AFTER this step
  requests: Req[]; // request outcomes shown on the timeline row
  headline: string;
};

// Precompute request outcomes for each step deterministically.
const BURST_3: Req[] = [
  { id: 1, allowed: true },
  { id: 2, allowed: true },
  { id: 3, allowed: true },
];

// 4 more requests but only 2 tokens are left, so 2 pass and 2 are turned away.
const BURST_4: Req[] = [
  { id: 4, allowed: true },
  { id: 5, allowed: true },
  { id: 6, allowed: false },
  { id: 7, allowed: false },
];

const FRAMES: Frame[] = [
  { time: "t = 0s", tokens: 5, requests: [], headline: "Bucket full" },
  { time: "t = 0s", tokens: 2, requests: BURST_3, headline: "3 requests arrive" },
  { time: "t = 0s", tokens: 0, requests: BURST_4, headline: "burst of 4 more" },
  { time: "t = 3s", tokens: 3, requests: [], headline: "lazy refill" },
  { time: "compare", tokens: 3, requests: [], headline: "sliding window counter" },
];

const NOTES: string[] = [
  "t=0s. Bucket full: 5/5 tokens. Refill rate 1 token/sec, capacity 5. Each request costs 1 token; a request is allowed only if a token is available.",
  "t=0s, 3 requests arrive at once. 3 tokens consumed, leaving 2/5. All 3 are ALLOWED — the bucket had enough tokens to pay for every one.",
  "t=0s, a burst of 4 more requests. Only 2 tokens remain, so 2 are ALLOWED and 2 are REJECTED once the bucket hits 0/5. This is the burst ceiling: you can spend down to capacity, then requests fail fast.",
  "t=3s. 3 seconds elapsed, so lazily refill 3 tokens: tokens = min(capacity, tokens + elapsed*rate) = min(5, 0 + 3*1) = 3/5 available again. No timer runs — you recompute tokens from the elapsed time on each incoming request.",
  "Sliding window counter alternative: keep timestamps of recent requests and count how many fall inside the last window; allow only if count < limit. Token bucket permits short bursts up to capacity plus a smooth amortized rate; the sliding window enforces a strict count per rolling window with no burst allowance beyond the limit.",
];

const ALLOW = "#16a34a";
const REJECT = "#dc2626";
const INK = "#0f172a";

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const idx = Math.min(step, FRAMES.length - 1);
  const f = FRAMES[idx];
  const isCompare = idx === FRAMES.length - 1;

  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: INK,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "4px 2px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        Token bucket rate limiter · capacity {CAPACITY} · refill {REFILL_RATE}/sec
      </div>

      {/* bucket + status row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12, alignItems: "flex-end" }}>
        {/* vertical bucket fill */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column-reverse",
              gap: 4,
              padding: 6,
              borderRadius: 10,
              border: "2px solid #94a3b8",
              background: "#f1f5f9",
            }}
          >
            {Array.from({ length: CAPACITY }, (_, i) => {
              const filled = i < f.tokens;
              return (
                <div
                  key={i}
                  style={{
                    width: 44,
                    height: 22,
                    borderRadius: 5,
                    background: filled ? "#0ea5e9" : "#e2e8f0",
                    border: `1px solid ${filled ? "#0284c7" : "#cbd5e1"}`,
                  }}
                />
              );
            })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: "#0369a1" }}>
            {f.tokens}/{CAPACITY} tokens
          </div>
        </div>

        {/* headline + math */}
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#0891b2" }}>{f.time}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{f.headline}</div>
          {idx === 3 && (
            <div
              style={{
                marginTop: 8,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                background: "#ecfeff",
                borderRadius: 8,
                padding: "6px 8px",
                color: "#155e75",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              tokens = min({CAPACITY}, 0 + 3 * {REFILL_RATE}) = 3
            </div>
          )}
        </div>
      </div>

      {/* request timeline row (only when there are requests) */}
      {f.requests.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>requests on the timeline</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {f.requests.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: r.allowed ? "#dcfce7" : "#fee2e2",
                  border: `1.5px solid ${r.allowed ? ALLOW : REJECT}`,
                  color: r.allowed ? "#166534" : "#991b1b",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800 }}>req {r.id}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  {r.allowed ? "allowed" : "rejected"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* contrast panel on the final step */}
      {isCompare && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8" }}>Token bucket</div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4, overflowWrap: "anywhere" }}>
              Allows short bursts up to capacity, then a smooth amortized rate. Great when spikes are fine as long as the
              long-run average stays bounded.
            </div>
          </div>
          <div style={{ background: "#fdf4ff", border: "1px solid #f0abfc", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#a21caf" }}>Sliding window counter</div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4, overflowWrap: "anywhere" }}>
              Counts requests in the last rolling window and allows only while count &lt; limit. Strict per-window cap,
              no burst beyond the limit.
            </div>
          </div>
        </div>
      )}

      {/* caption = NOTES[step] */}
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 64, color: "#334155", overflowWrap: "anywhere" }}>
        {NOTES[idx]}
      </div>

      {/* controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Prev
        </button>
        <button
          onClick={() => setStep((s) => Math.min(FRAMES.length - 1, s + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0284c7", background: "#0284c7", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          step {idx + 1} / {FRAMES.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={FRAMES.length - 1}
        value={idx}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%", maxWidth: "100%" }}
        aria-label="token bucket step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, overflowWrap: "anywhere" }}>
        A token bucket smooths traffic: it pays for each request with a token, refuses requests when the bucket is empty,
        and refills lazily by the elapsed time rather than a background loop. Tune capacity for how large a burst you
        tolerate and the refill rate for the steady throughput you want to sustain.
      </div>
    </div>
  );
}
