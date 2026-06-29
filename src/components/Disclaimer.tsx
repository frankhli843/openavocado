/**
 * Toy/experimental disclaimer banner for prodavo.
 * Only rendered when NEXT_PUBLIC_AVOCADOCORE_ENV=prodavo.
 * frankavo and devavo skip this component.
 */
export function Disclaimer() {
  if (process.env.NEXT_PUBLIC_AVOCADOCORE_ENV !== "prodavo") return null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
      <strong>Experimental toy project.</strong> Expect bugs, slow responses, missing features, and
      occasional data resets. Not for production use.
    </div>
  );
}
