export type RiskClass = "安定" | "中間" | "不安定";

export interface Country {
  name: string;
  iso2: string;
  iso3: string;
  region: string;
  rank: number;
  stabilityPercentile: number;
  riskClass: RiskClass;
  cashEvent: number;
  industry: string;
  rouletteText: string;
  roulette: number[];
  expectedReturn: number;
  latitude: number;
  longitude: number;
  flag: string;
}

export interface Neighbor {
  country: string;
  kind: string;
}

export interface Holding {
  country: string;
  value: number;
}

export interface Player {
  id: string;
  name: string;
  cash: number;
  debtNotes: number;
  location: string;
  holdings: Record<string, number>;
  orderRoll: number;
}

export type Phase = "start-turn" | "moving" | "pvp" | "invest" | "turn-end" | "finished";

export interface LogEntry {
  id: number;
  text: string;
}

export interface GameState {
  players: Player[];
  activeIndex: number;
  year: number;
  month: number;
  maxYears: number;
  phase: Phase;
  moveRemaining: number;
  lastMoveRoll: number | null;
  lastActionRoll: number | null;
  movementPath: string[];
  log: LogEntry[];
  nextLogId: number;
}

export interface SettlementResult {
  playerId: string;
  soldAll: boolean;
  paidNotes: number;
  remainingNotes: number;
}
