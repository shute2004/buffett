import type { Country, GameState, Player, SettlementResult } from "./types";

export const STARTING_CASH = 20_000;
export const DEBT_NOTE_CASH = 20_000;
export const DEBT_NOTE_REPAYMENT = 25_000;
export const MONEY_UNIT = 1_000;

export function roll10(random: () => number = Math.random): number {
  return Math.floor(random() * 10) + 1;
}

export function floorMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / MONEY_UNIT) * MONEY_UNIT;
}

export function halfMoney(value: number): number {
  return floorMoney(value / 2);
}

export function assetValue(player: Player): number {
  return Object.values(player.holdings).reduce((sum, value) => sum + value, 0);
}

export function debtFaceValue(player: Player): number {
  return player.debtNotes * DEBT_NOTE_CASH;
}

export function netWorth(player: Player): number {
  return player.cash + assetValue(player) - debtFaceValue(player);
}

export function ownerOf(state: GameState, countryName: string): Player | undefined {
  return state.players.find((player) => (player.holdings[countryName] ?? 0) > 0);
}

export function charge(player: Player, amount: number): number {
  const chargeAmount = floorMoney(amount);
  if (chargeAmount <= 0) return 0;

  if (player.cash < chargeAmount) {
    const shortfall = chargeAmount - player.cash;
    const notes = Math.ceil(shortfall / DEBT_NOTE_CASH);
    player.debtNotes += notes;
    player.cash += notes * DEBT_NOTE_CASH;
  }
  player.cash -= chargeAmount;
  return chargeAmount;
}

export function applyCashEvent(player: Player, country: Country): { amount: number; borrowedNotes: number } {
  const beforeNotes = player.debtNotes;
  if (country.cashEvent >= 0) {
    player.cash += country.cashEvent;
  } else {
    charge(player, Math.abs(country.cashEvent));
  }
  return { amount: country.cashEvent, borrowedNotes: player.debtNotes - beforeNotes };
}

export function invest(player: Player, country: Country, amount: number, roll: number): { before: number; after: number; percent: number } {
  const investment = floorMoney(amount);
  if (investment < MONEY_UNIT) {
    throw new Error("投資額は$1,000以上必要です");
  }
  if (investment > player.cash) {
    throw new Error("投資のために任意の借金はできません");
  }
  if (roll < 1 || roll > 10) {
    throw new Error("ルーレット結果は1〜10です");
  }

  player.cash -= investment;
  const before = (player.holdings[country.name] ?? 0) + investment;
  const percent = country.roulette[roll - 1];
  const after = floorMoney(before * (1 + percent / 100));

  if (after > 0) {
    player.holdings[country.name] = after;
  } else {
    delete player.holdings[country.name];
  }

  return { before, after, percent };
}

export function sellHolding(player: Player, countryName: string): number {
  const value = player.holdings[countryName] ?? 0;
  if (value <= 0) return 0;
  player.cash += value;
  delete player.holdings[countryName];
  return value;
}

export type PvpResult =
  | { kind: "owner-win"; amount: number; borrowedNotes: number; percent: number }
  | { kind: "nothing"; amount: 0; borrowedNotes: 0; percent: 0 }
  | { kind: "visitor-win"; amount: number; borrowedNotes: 0; percent: number };

export function resolvePvp(owner: Player, visitor: Player, country: Country, roll: number): PvpResult {
  const percent = country.roulette[roll - 1];
  const currentHolding = owner.holdings[country.name] ?? 0;
  const amount = halfMoney(currentHolding);

  if (percent > 0) {
    const beforeNotes = visitor.debtNotes;
    charge(visitor, amount);
    owner.cash += amount;
    return { kind: "owner-win", amount, borrowedNotes: visitor.debtNotes - beforeNotes, percent };
  }

  if (percent < 0) {
    const remaining = currentHolding - amount;
    if (remaining > 0) owner.holdings[country.name] = remaining;
    else delete owner.holdings[country.name];
    visitor.cash += amount;
    return { kind: "visitor-win", amount, borrowedNotes: 0, percent };
  }

  return { kind: "nothing", amount: 0, borrowedNotes: 0, percent: 0 };
}

export function settlePlayer(player: Player): SettlementResult {
  if (player.debtNotes <= 0) {
    return { playerId: player.id, soldAll: false, paidNotes: 0, remainingNotes: 0 };
  }

  const fullRepayment = player.debtNotes * DEBT_NOTE_REPAYMENT;
  let soldAll = false;
  if (player.cash < fullRepayment) {
    player.cash += assetValue(player);
    player.holdings = {};
    soldAll = true;
  }

  let paidNotes = 0;
  while (player.debtNotes > 0 && player.cash >= DEBT_NOTE_REPAYMENT) {
    player.cash -= DEBT_NOTE_REPAYMENT;
    player.debtNotes -= 1;
    paidNotes += 1;
  }

  return {
    playerId: player.id,
    soldAll,
    paidNotes,
    remainingNotes: player.debtNotes,
  };
}

export function createPlayers(names: string[], random: () => number = Math.random): Player[] {
  const players = names.map((name, index) => ({
    id: `p${index + 1}`,
    name: name.trim() || `プレイヤー${index + 1}`,
    cash: STARTING_CASH,
    debtNotes: 0,
    location: "日本",
    holdings: {},
    orderRoll: roll10(random),
  }));

  while (true) {
    const groups = new Map<number, Player[]>();
    for (const player of players) {
      const group = groups.get(player.orderRoll) ?? [];
      group.push(player);
      groups.set(player.orderRoll, group);
    }
    const tied = [...groups.values()].filter((group) => group.length > 1).flat();
    if (tied.length === 0) break;
    for (const player of tied) player.orderRoll = roll10(random);
  }

  return players.sort((a, b) => b.orderRoll - a.orderRoll);
}
