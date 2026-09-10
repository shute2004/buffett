import * as Phaser from "phaser";
import type { GameController } from "../../controller/GameController";
import { assetValue, netWorth } from "../../game";
import { audioService } from "../services/AudioService";

const PLAYER_COLORS = [0xe24d4d, 0x3978d4, 0x2f9d61, 0xe4a52e];

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
  }

  create(data: { controller: GameController }): void {
    const { width, height } = this.scale;
    const ranking = data.controller.ranking();
    this.cameras.main.setBackgroundColor("#123f52");

    for (let i = 0; i < 26; i += 1) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(-height, 0);
      const piece = this.add.rectangle(x, y, 9, 22, PLAYER_COLORS[i % PLAYER_COLORS.length], 0.9).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({ targets: piece, y: height + 80, angle: piece.angle + 260, duration: Phaser.Math.Between(2600, 4300), delay: Phaser.Math.Between(0, 1100), repeat: -1 });
    }

    this.add.text(width / 2, height * 0.11, "最終結果", {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "28px", fontStyle: "bold", color: "#ffe06b",
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.2, `${ranking[0].name} の勝ち！`, {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: `${Math.max(42, Math.min(72, width * 0.055))}px`, fontStyle: "bold", color: "#fff8d7",
      stroke: "#082b3b", strokeThickness: 6,
    }).setOrigin(0.5);

    const panelWidth = Math.min(840, width * 0.82);
    const rowHeight = Math.min(78, height * 0.105);
    ranking.forEach((player, index) => {
      const y = height * 0.36 + index * rowHeight;
      this.add.rectangle(width / 2, y, panelWidth, rowHeight - 10, 0xfbf3d6, 0.96).setStrokeStyle(index === 0 ? 5 : 2, index === 0 ? 0xf2c84b : 0x8fb1bd, 1);
      this.add.circle(width / 2 - panelWidth / 2 + 38, y, 22, PLAYER_COLORS[data.controller.state.players.findIndex((p) => p.id === player.id)], 1);
      this.add.text(width / 2 - panelWidth / 2 + 38, y, String(index + 1), { fontSize: "16px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
      this.add.text(width / 2 - panelWidth / 2 + 78, y - 12, player.name, { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "20px", fontStyle: "bold", color: "#173744" }).setOrigin(0, 0.5);
      this.add.text(width / 2 - panelWidth / 2 + 78, y + 13, `現金 $${player.cash.toLocaleString()}　株 $${assetValue(player).toLocaleString()}　借金 ${player.debtNotes}枚`, { fontSize: "12px", color: "#4a6772" }).setOrigin(0, 0.5);
      this.add.text(width / 2 + panelWidth / 2 - 34, y, `$${netWorth(player).toLocaleString()}`, { fontSize: "22px", fontStyle: "bold", color: "#1f667e" }).setOrigin(1, 0.5);
    });

    const button = this.add.rectangle(width / 2, height * 0.87, 220, 62, 0xf4ca4d, 1).setStrokeStyle(3, 0xffffff, 0.72).setInteractive({ useHandCursor: true });
    const label = this.add.text(width / 2, height * 0.87, "もう一度遊ぶ", { fontFamily: '"Noto Sans JP", system-ui, sans-serif', fontSize: "19px", fontStyle: "bold", color: "#173744" }).setOrigin(0.5);
    button.on("pointerdown", () => {
      audioService.click();
      this.scene.start("MenuScene");
    });
    void label;
  }
}
