/** Small floor so we never divide by zero on friction. */
export const FRICTION_EPS = 0.005;

export function alphaPerFriction(edge: number, bidAskSpread: number | undefined): number | undefined {
  if (bidAskSpread === undefined || !Number.isFinite(bidAskSpread) || bidAskSpread < 0) {
    return undefined;
  }
  return edge / (bidAskSpread + FRICTION_EPS);
}

export function capitalEfficiencyScore(
  expectedValuePerDollar: number,
  kellyFraction: number,
  kellyFloor = 0.001
): number {
  return expectedValuePerDollar / (kellyFraction + kellyFloor);
}
