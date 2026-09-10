import { describe, expect, it } from "vitest";
import { applyCashEvent, floorMoney, halfMoney, invest, resolvePvp, settlePlayer } from "../src/game";
import type { Country, Player } from "../src/types";

function makeCountry(overrides: Partial<Country> = {}): Country {
  return {
    name: "テスト国", iso2: "TT", iso3: "TST", region: "テスト", rank: 1,
    stabilityPercentile: 50, riskClass: "中間", cashEvent: 0, industry: "テスト産業",
    rouletteText: "1:+20%;2-9:0%;10:-20%", roulette: [20, 0, 0, 0, 0, 0, 0, 0, 0, -20], expectedReturn: 0,
    latitude: 0, longitude: 0, flag: "🏳️", ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return { id: "p1", name: "プレイヤー", cash: 20_000, debtNotes: 0, location: "テスト国", holdings: {}, orderRoll: 10, ...overrides };
}

describe("$1,000未満の切り捨て", () => {
  it("金額と半額を常に切り捨てる", () => {
    expect(floorMoney(2_500)).toBe(2_000);
    expect(halfMoney(5_000)).toBe(2_000);
    expect(halfMoney(1_000)).toBe(0);
  });
});

describe("投資", () => {
  it("追加投資では既存分を含む全額へルーレットを適用する", () => {
    const p = makePlayer({ holdings: { テスト国: 10_000 } });
    const result = invest(p, makeCountry(), 5_000, 1);
    expect(result).toEqual({ before: 15_000, after: 18_000, percent: 20 });
    expect(p.cash).toBe(15_000);
    expect(p.holdings["テスト国"]).toBe(18_000);
  });

  it("投資目的の任意借金はできない", () => {
    const p = makePlayer({ cash: 5_000 });
    expect(() => invest(p, makeCountry(), 6_000, 1)).toThrow("投資のために任意の借金はできません");
    expect(p.debtNotes).toBe(0);
  });
});

describe("支払い不足時の借金", () => {
  it("必要なときだけ$20,000単位で自動借金する", () => {
    const p = makePlayer({ cash: 0 });
    const event = applyCashEvent(p, makeCountry({ cashEvent: -38_000 }));
    expect(event.borrowedNotes).toBe(2);
    expect(p.debtNotes).toBe(2);
    expect(p.cash).toBe(2_000);
  });
});

describe("対人戦", () => {
  it("プラス目では所有者が半額を現金で徴収する", () => {
    const owner = makePlayer({ id: "owner", cash: 0, holdings: { テスト国: 10_000 } });
    const visitor = makePlayer({ id: "visitor", cash: 0 });
    const result = resolvePvp(owner, visitor, makeCountry(), 1);
    expect(result.kind).toBe("owner-win");
    expect(owner.cash).toBe(5_000);
    expect(owner.holdings["テスト国"]).toBe(10_000);
    expect(visitor.debtNotes).toBe(1);
    expect(visitor.cash).toBe(15_000);
  });

  it("マイナス目では所有者の半額を強制売却して訪問者へ渡す", () => {
    const owner = makePlayer({ id: "owner", holdings: { テスト国: 5_000 } });
    const visitor = makePlayer({ id: "visitor", cash: 0 });
    const result = resolvePvp(owner, visitor, makeCountry(), 10);
    expect(result.kind).toBe("visitor-win");
    expect(owner.holdings["テスト国"]).toBe(3_000);
    expect(visitor.cash).toBe(2_000);
  });
});

describe("年末決算", () => {
  it("現金だけで返済可能なら株式を維持する", () => {
    const p = makePlayer({ cash: 26_000, debtNotes: 1, holdings: { テスト国: 10_000 } });
    const result = settlePlayer(p);
    expect(result.soldAll).toBe(false);
    expect(p.cash).toBe(1_000);
    expect(p.debtNotes).toBe(0);
    expect(p.holdings["テスト国"]).toBe(10_000);
  });

  it("現金だけで全額返済できなければ全株式を差し押さえる", () => {
    const p = makePlayer({ cash: 10_000, debtNotes: 2, holdings: { テスト国: 45_000 } });
    const result = settlePlayer(p);
    expect(result.soldAll).toBe(true);
    expect(p.holdings).toEqual({});
    expect(p.debtNotes).toBe(0);
    expect(p.cash).toBe(5_000);
  });

  it("差し押さえ後も返せない借金は残る", () => {
    const p = makePlayer({ cash: 10_000, debtNotes: 2, holdings: { テスト国: 10_000 } });
    const result = settlePlayer(p);
    expect(result.soldAll).toBe(true);
    expect(p.holdings).toEqual({});
    expect(p.debtNotes).toBe(2);
    expect(p.cash).toBe(20_000);
  });
});
