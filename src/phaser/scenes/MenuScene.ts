import * as Phaser from "phaser";
import { audioService } from "../services/AudioService";

export interface GameStartData {
  names: string[];
  years: number;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    document.documentElement.dataset.buffettScene = "menu";
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#0d6c8d");

    const graphics = this.add.graphics();
    graphics.fillStyle(0x073c52, 0.36);
    graphics.fillCircle(width * 0.17, height * 0.28, Math.min(width, height) * 0.34);
    graphics.fillStyle(0xffd55d, 0.12);
    graphics.fillCircle(width * 0.82, height * 0.2, Math.min(width, height) * 0.24);

    this.add.text(width * 0.07, height * 0.13, "BUFFETT", {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: `${Math.max(58, Math.min(118, width * 0.075))}px`,
      fontStyle: "bold",
      color: "#fff5c7",
      stroke: "#173645",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 8, color: "#062d3b", blur: 18, fill: true },
    }).setOrigin(0, 0.5);

    this.add.text(width * 0.075, height * 0.25, "バフェット", {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif',
      fontSize: "28px",
      fontStyle: "bold",
      color: "#ffd55d",
      letterSpacing: 10,
    });

    this.add.text(width * 0.075, height * 0.35, "世界を巡り、投資し、最後に最も純資産を残せ。", {
      fontFamily: '"Noto Sans JP", system-ui, sans-serif',
      fontSize: "20px",
      color: "#e6f5f8",
      wordWrap: { width: Math.min(520, width * 0.42) },
      lineSpacing: 8,
    });

    const form = this.add.dom(width * 0.73, height * 0.53).createFromHTML(`
      <form class="setup-form">
        <div class="setup-heading">ゲーム設定</div>
        <label>プレイヤー数
          <select id="playerCount"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select>
        </label>
        <label>プレイ年数
          <input id="years" type="number" min="1" max="100" value="5" />
        </label>
        <div class="name-grid">
          <label>P1<input id="name1" maxlength="16" value="プレイヤー1" /></label>
          <label>P2<input id="name2" maxlength="16" value="プレイヤー2" /></label>
          <label>P3<input id="name3" maxlength="16" value="プレイヤー3" /></label>
          <label>P4<input id="name4" maxlength="16" value="プレイヤー4" /></label>
        </div>
        <button id="startGame" type="button">ゲーム開始</button>
        <small>開始地点：日本　初期資金：$20,000</small>
      </form>
    `);

    const startButton = form.node.querySelector<HTMLButtonElement>("#startGame");
    if (!startButton) throw new Error("ゲーム開始ボタンが見つかりません");

    startButton.addEventListener("click", () => {
      audioService.unlock();
      audioService.click();
      const count = Number((form.getChildByID("playerCount") as HTMLSelectElement).value);
      const years = Number((form.getChildByID("years") as HTMLInputElement).value);
      const names = Array.from({ length: count }, (_, index) => {
        const input = form.getChildByID(`name${index + 1}`) as HTMLInputElement;
        return input.value.trim() || `プレイヤー${index + 1}`;
      });

      startButton.disabled = true;
      startButton.textContent = "開始中…";
      this.scene.start("GameScene", {
        names,
        years: Phaser.Math.Clamp(Math.trunc(years) || 5, 1, 100),
      } satisfies GameStartData);
    });
  }
}
