import { describe, expect, it } from "vitest";
import { GameController } from "../src/controller/GameController";

function randomSequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

describe("GameController", () => {
  it("移動ルーレットから1マス移動して到着処理へ進む", () => {
    const controller = new GameController(["A", "B"], 5, randomSequence([0.9, 0.7, 0.0]));
    expect(controller.activePlayer.name).toBe("A");
    expect(controller.rollMove()).toBe(1);
    expect(controller.state.phase).toBe("start-turn");
    controller.beginMove();
    expect(controller.state.phase).toBe("moving");
    const destination = controller.activeNeighbors[0];
    const result = controller.moveTo(destination);
    expect(result.arrived).toBe(true);
    expect(controller.activePlayer.location).toBe(destination);
    expect(controller.state.phase).toBe("invest");
  });

  it("投資を見送るとターン終了し次プレイヤーへ移る", () => {
    const controller = new GameController(["A", "B"], 5, randomSequence([0.9, 0.7, 0.0]));
    controller.rollMove();
    controller.beginMove();
    controller.moveTo(controller.activeNeighbors[0]);
    controller.skipInvestment();
    expect(controller.state.phase).toBe("turn-end");
    const result = controller.advanceTurn();
    expect(result.finished).toBe(false);
    expect(controller.activePlayer.name).toBe("B");
    expect(controller.state.phase).toBe("start-turn");
  });

  it("隣国ではない国への移動を拒否する", () => {
    const controller = new GameController(["A", "B"], 5, randomSequence([0.9, 0.7, 0.0]));
    controller.rollMove();
    controller.beginMove();
    const invalid = controller.activeNeighbors.includes("ブラジル") ? "カナダ" : "ブラジル";
    expect(() => controller.moveTo(invalid)).toThrow(/移動できません/);
  });
});
