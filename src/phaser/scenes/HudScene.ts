import * as Phaser from "phaser";
import type { ArrivalResult, GameController } from "../../controller/GameController";
import { MONEY_UNIT, assetValue, floorMoney, ownerOf } from "../../game";
import { audioService } from "../services/AudioService";
import type { GameScene } from "./GameScene";

const PLAYER_COLORS = [0xe24d4d, 0x3978d4, 0x2f9d61, 0xe4a52e];
type MessageTone = "positive" | "negative" | "neutral";

export class HudScene extends Phaser.Scene {
  private board!: GameScene;
  private controller!: GameController;
  private root: Phaser.GameObjects.Container | null = null;
  private modal: Phaser.GameObjects.Container | null = null;
  private investmentAmount = 5_000;
  private previousPhase = "";

  constructor() {
    super("HudScene");
  }

  create(data: { board: GameScene; controller: GameController }): void {
    this.board = data.board;
    this.controller = data.controller;
    this.refresh();
    this.scale.on("resize", () => this.refresh());
  }

  refresh(): void {
    if (!this.controller) return;
    this.root?.destroy(true);
    this.root = this.add.container(0, 0).setDepth(100);

    const { width, height } = this.scale;
    const state = this.controller.state;
    const active = this.controller.activePlayer;
    const country = this.controller.currentCountry;

    const top = this.add.rectangle(width / 2, 49, width, 98, 0x123f52, 0.93).setStrokeStyle(2, 0xffffff, 0.22);
    this.root.add(top);
    this.root.add(this.add.text(22, 16, "BUFFETT", {
      fontFamily: "Georgia, serif", fontSize: "25px", fontStyle: "bold", color: "#fff2b8", stroke: "#092a38", strokeThickness: 3,
    }));
    this.root.add(this.add.text(23, 50, `${state.year}年目 ${state.month}月`, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "15px", fontStyle: "bold", color: "#ffffff",
    }));

    const playerAreaX = Math.min(190, width * 0.18);
    const available = Math.max(360, width - playerAreaX - 165);
    const cardWidth = Math.min(230, available / state.players.length - 8);
    state.players.forEach((player, index) => {
      const x = playerAreaX + index * (cardWidth + 8);
      const isActive = index === state.activeIndex;
      const plate = this.add.rectangle(x + cardWidth / 2, 49, cardWidth, 70, PLAYER_COLORS[index], isActive ? 0.98 : 0.62)
        .setStrokeStyle(isActive ? 3 : 1, isActive ? 0xffef8a : 0xffffff, isActive ? 1 : 0.35);
      const name = this.add.text(x + 12, 24, player.name, {
        fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "14px", fontStyle: "bold", color: "#ffffff",
      });
      const money = this.add.text(x + 12, 48, `$${player.cash.toLocaleString()}  株 $${assetValue(player).toLocaleString()}${player.debtNotes ? `  借${player.debtNotes}` : ""}`, {
        fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#fffbe8",
      });
      this.root?.add([plate, name, money]);
    });

    this.root.add(this.button(width - 105, 28, 54, 38, audioService.isMuted() ? "消音" : "音", () => {
      audioService.toggleMuted(); this.refresh();
    }, "ghost"));
    this.root.add(this.button(width - 45, 28, 54, 38, "地図", () => this.board.toggleOverview(), "ghost"));

    const dockHeight = 128;
    const dockY = height - dockHeight / 2;
    this.root.add(this.add.rectangle(width / 2, dockY, width, dockHeight, 0x0b2633, 0.94).setStrokeStyle(2, 0xffffff, 0.22));
    this.root.add(this.add.text(22, height - 112, `${country.flag} ${country.name}`, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "25px", fontStyle: "bold", color: "#fff5c9",
    }));
    this.root.add(this.add.text(24, height - 78, country.industry, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "13px", color: "#b9dce7",
    }));
    this.root.add(this.add.text(24, height - 53, `到着イベント ${country.cashEvent > 0 ? "+" : ""}$${country.cashEvent.toLocaleString()}`, {
      fontFamily: "system-ui, sans-serif", fontSize: "12px", color: country.cashEvent >= 0 ? "#89f0b4" : "#ff9e9e",
    }));

    const actionX = Math.max(350, width * 0.43);
    if (state.phase !== this.previousPhase && state.phase === "invest") this.investmentAmount = Math.min(5_000, floorMoney(active.cash));

    if (state.phase === "start-turn") {
      this.root.add(this.add.text(actionX, height - 105, `${active.name}のターン`, this.commandTitleStyle()));
      this.root.add(this.add.text(actionX, height - 76, "売却するなら今。準備ができたらルーレットを回します。", this.commandTextStyle()));
      this.root.add(this.button(width - 310, height - 61, 126, 58, "株式", () => this.showHoldings(0), "secondary"));
      this.root.add(this.button(width - 154, height - 61, 174, 66, "ルーレット", () => this.board.requestMoveRoll(), "primary"));
    } else if (state.phase === "moving") {
      this.root.add(this.add.text(actionX, height - 101, `あと ${state.moveRemaining} マス`, this.commandTitleStyle()));
      this.root.add(this.add.text(actionX, height - 70, "光っている隣国を地図上で選んでください。", this.commandTextStyle()));
    } else if (state.phase === "pvp") {
      const owner = ownerOf(state, country.name);
      const stake = owner ? floorMoney((owner.holdings[country.name] ?? 0) / 2) : 0;
      this.root.add(this.add.text(actionX, height - 101, "対人戦", this.commandTitleStyle("#ffb0a5")));
      this.root.add(this.add.text(actionX, height - 70, `${owner?.name ?? "所有者"} vs ${active.name}　勝敗で $${stake.toLocaleString()} が動きます。`, this.commandTextStyle()));
      this.root.add(this.button(width - 175, height - 62, 215, 66, "対人ルーレット", () => this.board.requestPvp(), "danger"));
    } else if (state.phase === "invest") {
      const max = floorMoney(active.cash);
      this.investmentAmount = Phaser.Math.Clamp(this.investmentAmount, max >= MONEY_UNIT ? MONEY_UNIT : 0, max);
      this.root.add(this.add.text(actionX, height - 108, "投資", this.commandTitleStyle("#9cffbd")));
      this.root.add(this.add.text(actionX, height - 77, max >= MONEY_UNIT ? `投資額 $${this.investmentAmount.toLocaleString()}` : "現金が$1,000未満のため投資できません。", this.commandTextStyle()));
      if (max >= MONEY_UNIT) {
        this.root.add(this.button(width - 430, height - 61, 54, 48, "−", () => this.changeInvestment(-MONEY_UNIT), "secondary"));
        this.root.add(this.button(width - 369, height - 61, 54, 48, "+", () => this.changeInvestment(MONEY_UNIT), "secondary"));
        this.root.add(this.button(width - 308, height - 61, 64, 48, "MAX", () => { this.investmentAmount = max; this.refresh(); }, "secondary"));
        this.root.add(this.button(width - 194, height - 61, 152, 60, "投資して回す", () => this.board.requestInvestment(this.investmentAmount), "primary"));
        this.root.add(this.button(width - 72, height - 61, 78, 48, "見送る", () => this.board.skipInvestment(), "ghost"));
      } else {
        this.root.add(this.button(width - 145, height - 61, 190, 56, "ターン終了へ", () => this.board.skipInvestment(), "secondary"));
      }
    } else if (state.phase === "turn-end") {
      this.root.add(this.add.text(actionX, height - 101, "行動完了", this.commandTitleStyle()));
      this.root.add(this.add.text(actionX, height - 70, state.log[0]?.text ?? "", this.commandTextStyle()));
      this.root.add(this.button(width - 155, height - 61, 210, 64, "次のプレイヤーへ", () => this.board.advanceTurn(), "primary"));
    }
    this.previousPhase = state.phase;
  }

  private changeInvestment(delta: number): void {
    const max = floorMoney(this.controller.activePlayer.cash);
    this.investmentAmount = Phaser.Math.Clamp(this.investmentAmount + delta, MONEY_UNIT, max);
    audioService.click(); this.refresh();
  }

  showTurnOrder(onClose: () => void): void {
    const lines = this.controller.state.players.map((player, index) => `${index + 1}位　${player.name}　出目 ${player.orderRoll}`).join("\n");
    this.showMessage("プレイ順決定", lines, "neutral", onClose, true);
  }

  showArrival(arrival: ArrivalResult, onClose: () => void): void {
    const amount = `${arrival.cashEvent > 0 ? "+" : ""}$${arrival.cashEvent.toLocaleString()}`;
    const borrowed = arrival.borrowedNotes > 0 ? `\n支払い不足で借金 ${arrival.borrowedNotes}枚` : "";
    this.showMessage(`${arrival.country.flag} ${arrival.country.name} に到着！`, `${arrival.country.industry}\n\n${amount}${borrowed}`,
      arrival.cashEvent > 0 ? "positive" : arrival.cashEvent < 0 ? "negative" : "neutral", onClose, true);
  }

  showMessage(title: string, detail: string, tone: MessageTone, onClose?: () => void, large = false): void {
    this.clearModal();
    const { width, height } = this.scale;
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x03131b, 0.64).setInteractive();
    const cardWidth = Math.min(650, width * 0.78);
    const cardHeight = large ? Math.min(430, height * 0.65) : Math.min(330, height * 0.52);
    const color = tone === "positive" ? 0x2d9b62 : tone === "negative" ? 0xc54d4d : 0x2f7592;
    const card = this.add.rectangle(width / 2, height / 2, cardWidth, cardHeight, 0xfff7db, 1).setStrokeStyle(8, color, 1);
    const heading = this.add.text(width / 2, height / 2 - cardHeight * 0.29, title, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: large ? "31px" : "28px", fontStyle: "bold", color: "#173744", align: "center", wordWrap: { width: cardWidth - 80 },
    }).setOrigin(0.5);
    const body = this.add.text(width / 2, height / 2, detail, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: large ? "21px" : "18px", color: tone === "positive" ? "#157048" : tone === "negative" ? "#9c3131" : "#294e5c", align: "center", lineSpacing: 10, wordWrap: { width: cardWidth - 100 },
    }).setOrigin(0.5);
    const close = this.button(width / 2, height / 2 + cardHeight * 0.31, 170, 54, "つぎへ", () => { audioService.click(); this.clearModal(); onClose?.(); }, "primary");
    this.modal = this.add.container(0, 0, [backdrop, card, heading, body, close]).setDepth(1000).setAlpha(0);
    this.tweens.add({ targets: this.modal, alpha: 1, duration: 160, ease: "Quad.easeOut" });
  }

  spin(title: string, labels: string[], result: number, onComplete: () => void): void {
    this.clearModal();
    const { width, height } = this.scale;
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x03131b, 0.72).setInteractive();
    const titleText = this.add.text(width / 2, Math.max(70, height * 0.14), title, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "28px", fontStyle: "bold", color: "#fff7d3",
    }).setOrigin(0.5);
    const wheel = this.add.container(width / 2, height / 2);
    const colors = [0xf6c453, 0x56b8d9, 0xf07a6b, 0x6fc68b, 0xb88ad8];
    for (let index = 0; index < 10; index += 1) {
      const start = -90 + index * 36; const end = start + 36;
      const arc = this.add.arc(0, 0, 158, start, end, false, colors[index % colors.length], 1).setStrokeStyle(2, 0xffffff, 0.7);
      const angle = Phaser.Math.DegToRad(start + 18);
      const number = this.add.text(Math.cos(angle) * 126, Math.sin(angle) * 126, String(index + 1), { fontFamily: "system-ui, sans-serif", fontSize: "16px", fontStyle: "bold", color: "#173744" }).setOrigin(0.5);
      const label = this.add.text(Math.cos(angle) * 88, Math.sin(angle) * 88, labels[index] ?? "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", fontStyle: "bold", color: "#ffffff", stroke: "#173744", strokeThickness: 3 }).setOrigin(0.5);
      wheel.add([arc, number, label]);
    }
    wheel.add(this.add.circle(0, 0, 45, 0x173744, 1).setStrokeStyle(5, 0xffe079, 1));
    wheel.add(this.add.text(0, 0, "B", { fontFamily: "Georgia, serif", fontSize: "31px", fontStyle: "bold", color: "#ffe17a" }).setOrigin(0.5));
    const pointer = this.add.text(width / 2, height / 2 - 188, "▼", { fontSize: "36px", color: "#fff1a8", stroke: "#173744", strokeThickness: 5 }).setOrigin(0.5);
    const resultText = this.add.text(width / 2, height / 2 + 205, "", { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "29px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
    this.modal = this.add.container(0, 0, [backdrop, titleText, wheel, pointer, resultText]).setDepth(1000);

    for (let index = 0; index < 14; index += 1) this.time.delayedCall(index * 75, () => audioService.rouletteTick());
    const rotation = 1080 + (10 - result) * 36;
    this.tweens.add({ targets: wheel, angle: rotation, duration: 1250, ease: "Cubic.easeOut", onComplete: () => {
      audioService.rouletteStop(); resultText.setText(`結果 ${result}　${labels[result - 1] ?? ""}`);
      this.time.delayedCall(620, () => { this.clearModal(); onComplete(); });
    }});
  }

  private showHoldings(page: number): void {
    this.clearModal();
    const { width, height } = this.scale;
    const holdings = Object.entries(this.controller.activePlayer.holdings).filter(([, value]) => value > 0);
    const pageSize = 6; const maxPage = Math.max(0, Math.ceil(holdings.length / pageSize) - 1); const currentPage = Phaser.Math.Clamp(page, 0, maxPage);
    const rows = holdings.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x03131b, 0.62).setInteractive();
    const panel = this.add.rectangle(width / 2, height / 2, Math.min(720, width * 0.82), Math.min(560, height * 0.78), 0xfff7db, 1).setStrokeStyle(7, 0x2f7592, 1);
    const items: Phaser.GameObjects.GameObject[] = [backdrop, panel];
    items.push(this.add.text(width / 2, height * 0.18, "保有株式", { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "28px", fontStyle: "bold", color: "#173744" }).setOrigin(0.5));
    if (rows.length === 0) {
      items.push(this.add.text(width / 2, height / 2, "保有株式はありません。", { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "20px", color: "#45616c" }).setOrigin(0.5));
    } else {
      rows.forEach(([country, value], index) => {
        const y = height * 0.27 + index * 55;
        items.push(this.add.text(width / 2 - 260, y, country, { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "17px", fontStyle: "bold", color: "#173744" }).setOrigin(0, 0.5));
        items.push(this.add.text(width / 2 + 40, y, `$${value.toLocaleString()}`, { fontFamily: "system-ui, sans-serif", fontSize: "17px", color: "#2f5c6d" }).setOrigin(1, 0.5));
        items.push(this.button(width / 2 + 185, y, 150, 40, "全額売却", () => { this.board.sellHolding(country); this.showHoldings(currentPage); }, "danger"));
      });
    }
    if (maxPage > 0) {
      items.push(this.button(width / 2 - 80, height * 0.77, 80, 38, "◀", () => this.showHoldings(currentPage - 1), "ghost"));
      items.push(this.add.text(width / 2, height * 0.77, `${currentPage + 1}/${maxPage + 1}`, { fontSize: "15px", color: "#45616c" }).setOrigin(0.5));
      items.push(this.button(width / 2 + 80, height * 0.77, 80, 38, "▶", () => this.showHoldings(currentPage + 1), "ghost"));
    }
    items.push(this.button(width / 2, height * 0.84, 150, 44, "閉じる", () => this.clearModal(), "secondary"));
    this.modal = this.add.container(0, 0, items).setDepth(1000);
  }

  private button(x: number, y: number, width: number, height: number, label: string, callback: () => void, kind: "primary" | "secondary" | "danger" | "ghost"): Phaser.GameObjects.Container {
    const fill = kind === "primary" ? 0xf5c84b : kind === "danger" ? 0xd85c55 : kind === "secondary" ? 0x3d7d96 : 0x163e50;
    const textColor = kind === "primary" ? "#173744" : "#ffffff";
    const background = this.add.rectangle(0, 0, width, height, fill, kind === "ghost" ? 0.72 : 1).setStrokeStyle(2, 0xffffff, kind === "ghost" ? 0.35 : 0.62).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: height >= 58 ? "17px" : "14px", fontStyle: "bold", color: textColor, align: "center" }).setOrigin(0.5);
    background.on("pointerover", () => background.setScale(1.035));
    background.on("pointerout", () => background.setScale(1));
    background.on("pointerdown", () => { audioService.unlock(); audioService.click(); callback(); });
    return this.add.container(x, y, [background, text]);
  }

  private commandTitleStyle(color = "#fff5c9"): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "23px", fontStyle: "bold", color };
  }

  private commandTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "13px", color: "#cbe6ee" };
  }

  private clearModal(): void {
    this.modal?.destroy(true); this.modal = null;
  }
}
