import { countryByName, neighborsOf } from "../data";
import {
  applyCashEvent,
  createPlayers,
  floorMoney,
  invest,
  netWorth,
  ownerOf,
  resolvePvp,
  roll10,
  sellHolding,
  settlePlayer,
} from "../game";
import type { Country, GameState, Player } from "../types";
import type { PvpResult } from "../game";

export interface ArrivalResult {
  country: Country;
  cashEvent: number;
  borrowedNotes: number;
  nextPhase: "pvp" | "invest";
}

export interface MoveStepResult {
  arrived: boolean;
  arrival?: ArrivalResult;
}

export interface InvestmentResult {
  amount: number;
  roll: number;
  before: number;
  after: number;
  percent: number;
}

export interface PvpResolution {
  roll: number;
  result: PvpResult;
}

export interface SettlementNotice {
  playerName: string;
  soldAll: boolean;
  paidNotes: number;
  remainingNotes: number;
}

export interface AdvanceResult {
  settledYear: number | null;
  settlements: SettlementNotice[];
  finished: boolean;
}

function requirePhase(state: GameState, expected: GameState["phase"]): void {
  if (state.phase !== expected) {
    throw new Error(`現在のフェーズは ${state.phase} です。${expected} ではありません。`);
  }
}

export class GameController {
  readonly state: GameState;

  constructor(names: string[], maxYears: number, private readonly random: () => number = Math.random) {
    const years = Math.max(1, Math.min(100, Math.trunc(maxYears) || 1));
    const players = createPlayers(names, random);
    if (players.length < 2 || players.length > 4) {
      throw new Error("プレイヤー数は2〜4人です");
    }

    this.state = {
      players,
      activeIndex: 0,
      year: 1,
      month: 1,
      maxYears: years,
      phase: "start-turn",
      moveRemaining: 0,
      lastMoveRoll: null,
      lastActionRoll: null,
      movementPath: [],
      log: [],
      nextLogId: 1,
    };

    this.log(`ゲーム開始。${years}年、開始地点は日本。`);
    this.log(`順番：${players.map((p) => `${p.name}(${p.orderRoll})`).join(" → ")}`);
  }

  get activePlayer(): Player {
    return this.state.players[this.state.activeIndex];
  }

  get currentCountry(): Country {
    const country = countryByName.get(this.activePlayer.location);
    if (!country) throw new Error(`国データがありません: ${this.activePlayer.location}`);
    return country;
  }

  get activeNeighbors(): string[] {
    return neighborsOf(this.activePlayer.location).map((neighbor) => neighbor.country);
  }

  get isFinished(): boolean {
    return this.state.phase === "finished";
  }

  log(text: string): void {
    this.state.log.unshift({ id: this.state.nextLogId++, text });
    this.state.log.length = Math.min(this.state.log.length, 40);
  }

  sell(countryName: string): number {
    requirePhase(this.state, "start-turn");
    const sold = sellHolding(this.activePlayer, countryName);
    if (sold > 0) this.log(`${this.activePlayer.name}は${countryName}を$${sold.toLocaleString()}で全額売却。`);
    return sold;
  }

  rollMove(): number {
    requirePhase(this.state, "start-turn");
    const roll = roll10(this.random);
    this.state.lastMoveRoll = roll;
    this.state.lastActionRoll = null;
    return roll;
  }

  beginMove(): number {
    requirePhase(this.state, "start-turn");
    const roll = this.state.lastMoveRoll;
    if (!roll) throw new Error("移動ルーレットがまだ確定していません");
    this.state.moveRemaining = roll;
    this.state.movementPath = [this.activePlayer.location];
    this.state.phase = "moving";
    this.log(`${this.activePlayer.name}の移動ルーレットは${roll}。`);
    return roll;
  }

  moveTo(countryName: string): MoveStepResult {
    requirePhase(this.state, "moving");
    if (!this.activeNeighbors.includes(countryName)) {
      throw new Error(`${this.activePlayer.location}から${countryName}へは移動できません`);
    }

    this.activePlayer.location = countryName;
    this.state.movementPath.push(countryName);
    this.state.moveRemaining -= 1;

    if (this.state.moveRemaining > 0) return { arrived: false };

    const country = this.currentCountry;
    const event = applyCashEvent(this.activePlayer, country);
    const owner = ownerOf(this.state, country.name);
    const nextPhase = owner && owner.id !== this.activePlayer.id ? "pvp" : "invest";
    this.state.phase = nextPhase;
    this.log(`${this.activePlayer.name}が${country.name}に到着。`);

    return {
      arrived: true,
      arrival: {
        country,
        cashEvent: event.amount,
        borrowedNotes: event.borrowedNotes,
        nextPhase,
      },
    };
  }

  rollAction(): number {
    if (this.state.phase !== "invest" && this.state.phase !== "pvp") {
      throw new Error("行動ルーレットを回せるフェーズではありません");
    }
    const roll = roll10(this.random);
    this.state.lastActionRoll = roll;
    return roll;
  }

  resolvePvp(roll: number): PvpResolution {
    requirePhase(this.state, "pvp");
    const country = this.currentCountry;
    const visitor = this.activePlayer;
    const owner = ownerOf(this.state, country.name);
    if (!owner || owner.id === visitor.id) throw new Error("対人戦の所有者が見つかりません");
    const result = resolvePvp(owner, visitor, country, roll);
    this.state.lastActionRoll = roll;
    this.state.phase = "turn-end";

    if (result.kind === "owner-win") {
      this.log(`${country.name}：${owner.name}が${visitor.name}から$${result.amount.toLocaleString()}獲得。`);
    } else if (result.kind === "visitor-win") {
      this.log(`${country.name}：${visitor.name}が$${result.amount.toLocaleString()}獲得。`);
    } else {
      this.log(`${country.name}：対人戦は変化なし。`);
    }

    return { roll, result };
  }

  invest(amount: number, roll: number): InvestmentResult {
    requirePhase(this.state, "invest");
    const investment = floorMoney(amount);
    const country = this.currentCountry;
    const result = invest(this.activePlayer, country, investment, roll);
    this.state.lastActionRoll = roll;
    this.state.phase = "turn-end";
    this.log(`${this.activePlayer.name}は${country.name}へ$${investment.toLocaleString()}投資。`);
    return { amount: investment, roll, ...result };
  }

  skipInvestment(): void {
    requirePhase(this.state, "invest");
    this.log(`${this.activePlayer.name}は${this.currentCountry.name}への投資を見送った。`);
    this.state.phase = "turn-end";
  }

  advanceTurn(): AdvanceResult {
    requirePhase(this.state, "turn-end");
    let settledYear: number | null = null;
    const settlements: SettlementNotice[] = [];

    this.state.activeIndex += 1;
    this.state.lastMoveRoll = null;
    this.state.lastActionRoll = null;
    this.state.movementPath = [];

    if (this.state.activeIndex >= this.state.players.length) {
      this.state.activeIndex = 0;
      this.state.month += 1;

      if (this.state.month > 12) {
        settledYear = this.state.year;
        for (const player of this.state.players) {
          if (player.debtNotes <= 0) continue;
          const result = settlePlayer(player);
          settlements.push({
            playerName: player.name,
            soldAll: result.soldAll,
            paidNotes: result.paidNotes,
            remainingNotes: result.remainingNotes,
          });
        }

        if (this.state.year >= this.state.maxYears) {
          this.state.phase = "finished";
          return { settledYear, settlements, finished: true };
        }

        this.state.year += 1;
        this.state.month = 1;
      }
    }

    this.state.phase = "start-turn";
    return { settledYear, settlements, finished: false };
  }

  ranking(): Player[] {
    return [...this.state.players].sort((a, b) => netWorth(b) - netWorth(a));
  }
}
