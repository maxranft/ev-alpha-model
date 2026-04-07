export function americanToDecimal(americanOdds: number): number {
  if (americanOdds === 0) {
    throw new Error("American odds cannot be zero.");
  }
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds);
}

export function impliedProbabilityFromDecimal(decimalOdds: number): number {
  if (decimalOdds <= 1) {
    throw new Error("Decimal odds must be greater than 1.");
  }
  return 1 / decimalOdds;
}

export function impliedProbabilityFromAmerican(americanOdds: number): number {
  return impliedProbabilityFromDecimal(americanToDecimal(americanOdds));
}

export function noVigTwoWay(
  sideAImplied: number,
  sideBImplied: number
): { sideAFair: number; sideBFair: number; overround: number } {
  if (sideAImplied <= 0 || sideBImplied <= 0) {
    throw new Error("Implied probabilities must be positive.");
  }
  const overround = sideAImplied + sideBImplied;
  return {
    sideAFair: sideAImplied / overround,
    sideBFair: sideBImplied / overround,
    overround
  };
}
