import "server-only";

// Chỉ đo trên server khi dev (hoặc bật CATALOG_TIMING=1). Không ghi cookie/token.
export function catalogTimer(label: string) {
  const start = performance.now();
  return (counts: Record<string, number> = {}) => {
    if (process.env.NODE_ENV === "development" || process.env.CATALOG_TIMING === "1") {
      console.info("[catalog]", { stage: label, ms: Math.round(performance.now() - start), ...counts });
    }
  };
}
