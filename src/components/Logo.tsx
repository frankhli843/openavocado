import type { CSSProperties } from "react";

/**
 * AvocadoCore brand mark + wordmark.
 *
 * Note: Frank has a prior AvocadoCore startup/logo asset in Google Drive that
 * should replace this when Drive OAuth is restored (both lifrank1994 and
 * wsfccorp tokens were invalid_grant at build time). Until then this clean,
 * on-brand avocado mark gives the app a proper favicon and header logo.
 */
export function AvocadoMark({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="AvocadoCore"
      style={style}
    >
      <path d="M32 9c-9 0-14.5 12-14.5 24S24 56 32 56s14.5-11 14.5-23S41 9 32 9z" fill="#3c7d3f" />
      <path d="M32 15c-6.4 0-10.5 9-10.5 18S26 51 32 51s10.5-9 10.5-18S38.4 15 32 15z" fill="#cfe8a3" />
      <circle cx="32" cy="38" r="8.5" fill="#8a5a3c" />
      <circle cx="29.4" cy="35.4" r="2.4" fill="#a87650" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <AvocadoMark size={size} />
      <span className="font-semibold text-gray-900 tracking-tight">
        Avocado<span className="text-green-700">Core</span>
      </span>
    </span>
  );
}
