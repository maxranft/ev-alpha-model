import type { ScoredPick } from "../src/types.js";

export type SimulationObjective = "balanced" | "growth" | "stability";

export interface SimulationConfig {
  bankroll: number;
  maxStakePct: number;
  trials: number;
  cycles: number;
  objective: SimulationObjective;
  frequencies: number[];
  volumeScales: number[];
  random?: () => number;
}

export interface SimulationCell {
  frequency: number;
  volumeScale: number;
  averageEndingBankroll: number;
  averagePnl: number;
  averageReturnPct: number;
  averageMaxDrawdownPct: number;
  winRate: number;
  averageTrades: number;
  score: number;
}

export interface SimulationReport {
  cells: SimulationCell[];
  best: SimulationCell | null;
  baseline: SimulationCell | null;
}

interface TrialStats {
  endingBankroll: number;
  pnl: number;
  maxDrawdownPct: number;
  wins: number;
  trades: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], average: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function weightedIndex(weights: number[], random: () => number): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return Math.floor(random() * weights.length);
  }
  let remaining = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    remaining -= weights[index] ?? 0;
    if (remaining <= 0) {
      return index;
    }
  }
  return Math.max(0, weights.length - 1);
}

function selectPicks(picks: ScoredPick[], count: number, random: () => number): ScoredPick[] {
  const working = [...picks];
  const chosen: ScoredPick[] = [];
  while (working.length > 0 && chosen.length < count) {
    const weights = working.map((pick) =>
      Math.max(0.0001, Math.abs(pick.edge) * 3 + Math.max(pick.expectedValuePerDollar, 0) + 0.01)
    );
    const index = weightedIndex(weights, random);
    const [next] = working.splice(index, 1);
    if (next) {
      chosen.push(next);
    }
  }
  return chosen;
}

function baseStake(bankroll: number, maxStakePct: number, pick: ScoredPick, volumeScale: number): number {
  const cappedKelly = bankroll * clamp(pick.kellyFraction, 0, 0.35);
  const cap = bankroll * (maxStakePct / 100);
  return Math.max(0, Math.min(cappedKelly, cap) * volumeScale);
}

function marketProbability(pick: ScoredPick, buySide: boolean): number {
  const probability = buySide ? pick.impliedProbability : 1 - pick.impliedProbability;
  return clamp(probability, 0.02, 0.98);
}

function trueProbability(pick: ScoredPick, buySide: boolean): number {
  const probability = buySide ? pick.model.coverProbability : 1 - pick.model.coverProbability;
  return clamp(probability, 0.02, 0.98);
}

function simulateTrade(
  pick: ScoredPick,
  bankroll: number,
  maxStakePct: number,
  volumeScale: number,
  random: () => number
): { bankrollDelta: number; win: boolean } {
  const buySide = pick.edge >= 0;
  const probability = marketProbability(pick, buySide);
  const trueProb = trueProbability(pick, buySide);
  const stake = Math.min(baseStake(bankroll, maxStakePct, pick, volumeScale), bankroll);
  if (stake < 1) {
    return { bankrollDelta: 0, win: false };
  }

  const decimalOdds = 1 / probability;
  const grossPnl = random() <= trueProb ? stake * (decimalOdds - 1) : -stake;
  const frictionPenalty = stake * clamp(pick.line.polymarket?.bidAskSpread ?? 0.01, 0, 0.12) * 0.5;
  const liquidity = pick.line.polymarket?.liquidity ?? 0;
  const sizePressure = liquidity > 0 ? stake / Math.max(liquidity * 0.02, 1) : 0;
  const liquidityPenalty = sizePressure > 1 ? stake * Math.min((sizePressure - 1) * 0.015, 0.06) : 0;
  const bankrollDelta = grossPnl - frictionPenalty - liquidityPenalty;
  return {
    bankrollDelta,
    win: bankrollDelta > 0
  };
}

function runTrial(
  picks: ScoredPick[],
  bankroll: number,
  maxStakePct: number,
  cycles: number,
  frequency: number,
  volumeScale: number,
  random: () => number
): TrialStats {
  let currentBankroll = bankroll;
  let peakBankroll = bankroll;
  let maxDrawdownPct = 0;
  let wins = 0;
  let trades = 0;

  const activeUniverse = picks.slice(0, Math.max(frequency * 3, Math.min(12, picks.length)));

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    if (currentBankroll <= 1) {
      break;
    }
    const cyclePicks = selectPicks(activeUniverse, frequency, random);
    for (const pick of cyclePicks) {
      if (currentBankroll <= 1) {
        break;
      }
      const { bankrollDelta, win } = simulateTrade(
        pick,
        currentBankroll,
        maxStakePct,
        volumeScale,
        random
      );
      if (Math.abs(bankrollDelta) < 0.0001) {
        continue;
      }
      trades += 1;
      if (win) {
        wins += 1;
      }
      currentBankroll = Math.max(0, currentBankroll + bankrollDelta);
      peakBankroll = Math.max(peakBankroll, currentBankroll);
      if (peakBankroll > 0) {
        maxDrawdownPct = Math.max(maxDrawdownPct, (peakBankroll - currentBankroll) / peakBankroll);
      }
    }
  }

  return {
    endingBankroll: currentBankroll,
    pnl: currentBankroll - bankroll,
    maxDrawdownPct,
    wins,
    trades
  };
}

function scoreCell(
  objective: SimulationObjective,
  averageReturnPct: number,
  averageMaxDrawdownPct: number,
  winRate: number,
  volatilityPct: number
): number {
  switch (objective) {
    case "growth":
      return averageReturnPct * 1.25 - averageMaxDrawdownPct * 0.55 - volatilityPct * 0.2;
    case "stability":
      return (
        averageReturnPct * 0.8 -
        averageMaxDrawdownPct * 1.15 -
        volatilityPct * 0.45 +
        winRate * 12
      );
    default:
      return (
        averageReturnPct -
        averageMaxDrawdownPct * 0.8 -
        volatilityPct * 0.3 +
        winRate * 8
      );
  }
}

export function runTrainingSimulation(
  picks: ScoredPick[],
  config: SimulationConfig
): SimulationReport {
  const random = config.random ?? Math.random;
  const usablePicks = picks.filter(
    (pick) => Number.isFinite(pick.edge) && Number.isFinite(pick.expectedValuePerDollar)
  );

  if (usablePicks.length === 0 || config.bankroll <= 0) {
    return {
      cells: [],
      best: null,
      baseline: null
    };
  }

  const cells: SimulationCell[] = [];

  for (const frequency of config.frequencies) {
    for (const volumeScale of config.volumeScales) {
      const trials: TrialStats[] = [];
      for (let trial = 0; trial < config.trials; trial += 1) {
        trials.push(
          runTrial(
            usablePicks,
            config.bankroll,
            config.maxStakePct,
            config.cycles,
            frequency,
            volumeScale,
            random
          )
        );
      }

      const returns = trials.map((trial) => (trial.endingBankroll - config.bankroll) / config.bankroll);
      const averageReturn = mean(returns);
      const averageReturnPct = averageReturn * 100;
      const averagePnl = mean(trials.map((trial) => trial.pnl));
      const averageEndingBankroll = mean(trials.map((trial) => trial.endingBankroll));
      const averageMaxDrawdownPct = mean(trials.map((trial) => trial.maxDrawdownPct * 100));
      const trades = mean(trials.map((trial) => trial.trades));
      const winRate =
        mean(
          trials.map((trial) => (trial.trades > 0 ? trial.wins / trial.trades : 0))
        );
      const volatilityPct = stdDev(
        returns.map((value) => value * 100),
        averageReturnPct
      );

      cells.push({
        frequency,
        volumeScale,
        averageEndingBankroll,
        averagePnl,
        averageReturnPct,
        averageMaxDrawdownPct,
        winRate,
        averageTrades: trades,
        score: scoreCell(
          config.objective,
          averageReturnPct,
          averageMaxDrawdownPct,
          winRate,
          volatilityPct
        )
      });
    }
  }

  const sorted = [...cells].sort((left, right) => right.score - left.score);
  const baseline =
    sorted.find(
      (cell) => Math.abs(cell.volumeScale - 1) < 0.0001 && cell.frequency === 1
    ) ?? null;

  return {
    cells: sorted,
    best: sorted[0] ?? null,
    baseline
  };
}
