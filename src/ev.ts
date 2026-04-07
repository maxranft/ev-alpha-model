export function expectedValuePerDollar(
  winProbability: number,
  decimalOdds: number
): number {
  if (winProbability < 0 || winProbability > 1) {
    throw new Error("Win probability must be between 0 and 1.");
  }
  if (decimalOdds <= 1) {
    throw new Error("Decimal odds must be greater than 1.");
  }
  const netWin = decimalOdds - 1;
  return winProbability * netWin - (1 - winProbability);
}

export function kellyFraction(
  winProbability: number,
  decimalOdds: number,
  kellyScale = 0.5
): number {
  if (kellyScale < 0 || kellyScale > 1) {
    throw new Error("Kelly scale must be between 0 and 1.");
  }
  const b = decimalOdds - 1;
  const q = 1 - winProbability;
  const rawKelly = (b * winProbability - q) / b;
  return Math.max(0, rawKelly) * kellyScale;
}
