export function spreadDiscrepancyScore(
  marketSpread: number,
  modelFairSpread: number
): number {
  if (!Number.isFinite(marketSpread) || !Number.isFinite(modelFairSpread)) {
    throw new Error("Spread values must be finite numbers.");
  }
  return modelFairSpread - marketSpread;
}
