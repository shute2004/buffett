import * as Phaser from "phaser";
import { GameController } from "../../controller/GameController";
import { BoardView } from "../BoardView";
import { createWorldMapCanvas } from "../WorldProjection";
import { audioService } from "../services/AudioService";
import type { GameStartData } from "./MenuScene";
import type { HudScene } from "./HudScene";

function percentLabel(value: number): string {
  return `${value > 0 ? "+" : ""}${value}%`;
}

export class GameScene extends Phaser.Scene {
  controller!: GameController;
  board!: BoardView;
  private inputLocked = false;

  constructor() {
    super("GameScene");
  }

  create(data: GameStartData): void {
    document.documentElement.dataset.buffettScene = "game";

    if (!this.textures.exists("world-map")) {
      const texture = this.textures.addCanvas("world-map", createWorldMapCanvas());
      texture?.refresh();
    }

    this.controller = new GameController(data.names, data.years);
    this.board = new BoardView(this, this.controller);
    this.board.onCountrySelected = (countryName) => this.moveOneStep(countryName);

    this.scene.launch("HudScene", { board: this, controller: this.controller });
    this.time.delayedCall(80, () => {
      this.board.focusActive(0);
      this.hud().showTurnOrder(() => this.hud().refresh());
    });
  }

  private hud(): HudScene {
    return this.scene.get("HudScene") as HudScene;
  }

  requestMoveRoll(): void {
    if (this.inputLocked || this.controller.state.phase !== "start-turn") return;
    this.inputLocked = true;
    const roll = this.controller.rollMove();
    const labels = Array.from({ length: 10 }, (_, index) => String(index + 1));
    this.hud().spin("移動ルーレット", labels, roll, () => {
      this.controller.beginMove();
      this.inputLocked = false;
      this.board.refresh();
      this.hud().refresh();
    });
  }

  private moveOneStep(countryName: string): void {
    if (this.inputLocked || this.controller.state.phase !== "moving") return;
    this.inputLocked = true;
    audioService.step();
    this.board.animateActiveTokenTo(countryName, () => {
      const result = this.controller.moveTo(countryName);
      this.inputLocked = false;
      this.board.refresh();
      this.hud().refresh();

      if (result.arrival && result.arrived) {
        if (result.arrival.cashEvent > 0) audioService.cashUp();
        else if (result.arrival.cashEvent < 0) audioService.cashDown();
        else audioService.neutral();
        this.hud().showArrival(result.arrival, () => this.hud().refresh());
      }
    });
  }

  requestPvp(): void {
    if (this.inputLocked || this.controller.state.phase !== "pvp") return;
    this.inputLocked = true;
    const country = this.controller.currentCountry;
    const roll = this.controller.rollAction();
    audioService.battle();
    this.hud().spin(`${country.name} 対人戦`, country.roulette.map(percentLabel), roll, () => {
      const resolution = this.controller.resolvePvp(roll);
      this.inputLocked = false;
      this.board.refresh();
      this.hud().refresh();

      if (resolution.result.kind === "owner-win") {
        audioService.investUp();
        this.hud().showMessage(
          "所有者の勝ち",
          `$${resolution.result.amount.toLocaleString()} が所有者へ移動しました。`,
          "positive",
        );
      } else if (resolution.result.kind === "visitor-win") {
        audioService.investUp();
        this.hud().showMessage(
          "訪問者の勝ち",
          `$${resolution.result.amount.toLocaleString()} を獲得しました。`,
          "positive",
        );
      } else {
        audioService.neutral();
        this.hud().showMessage("変化なし", "今回は資産の移動はありません。", "neutral");
      }
    });
  }

  requestInvestment(amount: number): void {
    if (this.inputLocked || this.controller.state.phase !== "invest") return;
    this.inputLocked = true;
    const country = this.controller.currentCountry;
    const roll = this.controller.rollAction();
    this.hud().spin(`${country.name} 投資`, country.roulette.map(percentLabel), roll, () => {
      const result = this.controller.invest(amount, roll);
      this.inputLocked = false;
      this.board.refresh();
      this.hud().refresh();

      if (result.percent > 0) audioService.investUp();
      else if (result.percent < 0) audioService.investDown();
      else audioService.neutral();
      this.hud().showMessage(
        result.percent > 0 ? "投資成功" : result.percent < 0 ? "投資下落" : "横ばい",
        `$${result.before.toLocaleString()} → $${result.after.toLocaleString()}（${percentLabel(result.percent)}）`,
        result.percent > 0 ? "positive" : result.percent < 0 ? "negative" : "neutral",
      );
    });
  }

  skipInvestment(): void {
    if (this.controller.state.phase !== "invest") return;
    audioService.click();
    this.controller.skipInvestment();
    this.hud().refresh();
  }

  sellHolding(countryName: string): number {
    const sold = this.controller.sell(countryName);
    if (sold > 0) {
      audioService.cashUp();
      this.board.refresh();
      this.hud().refresh();
    }
    return sold;
  }

  advanceTurn(): void {
    if (this.inputLocked || this.controller.state.phase !== "turn-end") return;
    const result = this.controller.advanceTurn();
    if (result.finished) {
      this.scene.stop("HudScene");
      this.scene.start("ResultScene", { controller: this.controller });
      return;
    }

    audioService.turn();
    this.board.refresh();
    this.board.focusActive(480);
    this.hud().refresh();

    if (result.settledYear !== null) {
      const sold = result.settlements.filter((item) => item.soldAll).map((item) => item.playerName);
      const detail = result.settlements.length === 0
        ? "借金のあるプレイヤーはいませんでした。"
        : sold.length > 0
          ? `${sold.join("、")} は返済不能のため全株式が差し押さえられました。`
          : "借金のあるプレイヤーは年末返済を行いました。";
      this.hud().showMessage(`${result.settledYear}年目 決算`, detail, sold.length > 0 ? "negative" : "neutral");
    }
  }

  toggleOverview(): void {
    this.board.showOverview();
  }
}
