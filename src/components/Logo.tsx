import type { CSSProperties } from "react";

/**
 * AvocadoCore brand mark.
 *
 * Vector avocado mark derived from the original AvocadoCore brand asset
 * (Avocado_logo.svg in Google Drive): exact teardrop geometry and palette
 * (skin #399103, flesh #f8ee7b, white pit). The same mark is used for the
 * favicon (src/app/icon.svg); the full square "AVO" badge is used for the
 * apple-touch and PWA manifest icons.
 */
export function AvocadoMark({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="635 -20 445 445"
      role="img"
      aria-label="Open Avocado"
      style={style}
    >
      <path
        fill="#399103"
        d="M1232.67-1000.76a125.34,125.34,0,0,1,1-13c3.4-33,13.92-86.75,57.37-160.78,33-56.25,49.52-84.38,70.72-85.09,26.54-.89,46.12,32.06,79.12,87.6,39.58,66.6,49.47,123.11,52.53,154.17.83,8.43,1.25,12.64,1.12,17.1-1.53,52.59-48.78,130.92-130.92,130.92A130.92,130.92,0,0,1,1232.67-1000.76Z"
        transform="translate(-506.6 1267.13)"
      />
      <path
        fill="#f8ee7b"
        d="M1275.87-1006.33a84,84,0,0,1,.65-8.7c2.28-22.12,9.33-58.12,38.44-107.73,22.12-37.69,33.18-56.53,47.38-57,17.78-.6,30.9,21.48,53,58.69,26.52,44.62,33.14,82.48,35.2,103.29a90.81,90.81,0,0,1,.75,11.45c-1,35.23-32.68,87.71-87.71,87.71A87.71,87.71,0,0,1,1275.87-1006.33Z"
        transform="translate(-506.6 1267.13)"
      />
      <circle fill="#fff" cx="856.99" cy="264.46" r="42.81" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <AvocadoMark size={size} />
      <span className="font-semibold text-gray-900 tracking-tight">
        Open <span className="text-green-700">Avocado</span>
      </span>
    </span>
  );
}
