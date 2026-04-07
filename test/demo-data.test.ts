import { describe, expect, it } from "vitest";
import { demoCandidates } from "../src/demo-data.js";
import { rankPicks } from "../src/rank.js";

describe("demoCandidates", () => {
  it("ranks without throwing", () => {
    const ranked = rankPicks(demoCandidates, {
      minEdge: 0,
      minExpectedValue: -1,
      kellyScale: 0.5
    });
    expect(ranked.length).toBeGreaterThan(0);
    expect(demoCandidates.length).toBeGreaterThanOrEqual(3);
  });
});
