import * as Phaser from "phaser";
import { adjacency, countries, neighborsOf } from "../data";
import type { GameController } from "../controller/GameController";
import { WORLD_HEIGHT, WORLD_WIDTH, countryPoint, nearestWrappedX } from "./WorldProjection";

const PLAYER_COLORS = [0xe24d4d, 0x3978d4, 0x2f9d61, 0xe4a52e];
const LABEL_RESOLUTION = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

interface StationView {
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  ownerBadge: Phaser.GameObjects.Arc;
}

export class BoardView {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly stations = new Map<string, StationView>();
  private readonly tokens = new Map<string, Phaser.GameObjects.Container>();
  private readonly routeGraphics: Phaser.GameObjects.Graphics;
  private readonly ownedCountries = new Set<string>();
  private overview = false;
  onCountrySelected: ((countryName: string) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly controller: GameController) {
    this.camera = scene.cameras.main;
    this.camera.setBackgroundColor("#55a7c7");
    this.camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    scene.add.image(0, 0, "world-map").setOrigin(0).setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(0);

    this.routeGraphics = scene.add.graphics().setDepth(1);
    this.drawRoutes();
    this.createStations();
    this.createTokens();
    this.refresh();

    scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      if (this.overview) return;
      const next = Phaser.Math.Clamp(this.camera.zoom - deltaY * 0.0012, 0.65, 2.8);
      this.camera.setZoom(next);
      this.updateLabelVisibility();
    });
  }

  private drawRoutes(): void {
    this.routeGraphics.clear();
    this.routeGraphics.lineStyle(3, 0xffffff, 0.34);
    const seen = new Set<string>();

    for (const [a, neighbors] of adjacency) {
      for (const neighbor of neighbors) {
        const key = [a, neighbor.country].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        const p1 = countryPoint(a);
        const p2 = countryPoint(neighbor.country);
        const deltaX = p2.x - p1.x;

        if (Math.abs(deltaX) <= WORLD_WIDTH / 2) {
          this.drawLine(p1.x, p1.y, p2.x, p2.y);
          continue;
        }

        if (deltaX > 0) {
          this.drawLine(p1.x, p1.y, p2.x - WORLD_WIDTH, p2.y);
          this.drawLine(p1.x + WORLD_WIDTH, p1.y, p2.x, p2.y);
        } else {
          this.drawLine(p1.x, p1.y, p2.x + WORLD_WIDTH, p2.y);
          this.drawLine(p1.x - WORLD_WIDTH, p1.y, p2.x, p2.y);
        }
      }
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    this.routeGraphics.beginPath();
    this.routeGraphics.moveTo(x1, y1);
    this.routeGraphics.lineTo(x2, y2);
    this.routeGraphics.strokePath();
  }

  private createStations(): void {
    for (const country of countries) {
      const point = countryPoint(country.name);
      const ring = this.scene.add.circle(point.x, point.y, 16, 0xffef9a, 0).setStrokeStyle(3, 0xfff4b6, 0).setDepth(2);
      const circle = this.scene.add.circle(point.x, point.y, 7, 0xf8f1d2, 1).setStrokeStyle(2, 0x34586b, 1).setDepth(3);
      const ownerBadge = this.scene.add.circle(point.x + 11, point.y - 10, 4, 0xffffff, 0).setDepth(4);
      const label = this.scene.add.text(point.x, point.y - 18, country.name, {
        fontFamily: '"Noto Sans JP", system-ui, sans-serif',
        fontSize: "11px",
        color: "#183442",
        backgroundColor: "#fff9df",
        padding: { x: 4, y: 2 },
        resolution: LABEL_RESOLUTION,
      }).setOrigin(0.5, 1).setDepth(4).setVisible(false);

      circle.setInteractive({ useHandCursor: true });
      circle.on("pointerdown", () => {
        if (this.controller.state.phase !== "moving") return;
        if (!neighborsOf(this.controller.activePlayer.location).some((n) => n.country === country.name)) return;
        this.onCountrySelected?.(country.name);
      });

      this.stations.set(country.name, { circle, ring, label, ownerBadge });
    }
  }

  private createTokens(): void {
    this.controller.state.players.forEach((player, index) => {
      const shadow = this.scene.add.ellipse(0, 12, 30, 11, 0x17343d, 0.28);
      const stem = this.scene.add.rectangle(0, 2, 17, 18, PLAYER_COLORS[index], 1).setStrokeStyle(2, 0xffffff, 0.9);
      const head = this.scene.add.circle(0, -9, 10, PLAYER_COLORS[index], 1).setStrokeStyle(2, 0xffffff, 1);
      const number = this.scene.add.text(0, -9, String(index + 1), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#ffffff",
        resolution: LABEL_RESOLUTION,
      }).setOrigin(0.5);
      const token = this.scene.add.container(0, 0, [shadow, stem, head, number]).setDepth(10 + index);
      this.tokens.set(player.id, token);
    });
  }

  refresh(): void {
    const state = this.controller.state;
    const current = this.controller.activePlayer.location;
    const selectable = new Set(state.phase === "moving" ? this.controller.activeNeighbors : []);
    const owners = new Map<string, number>();
    this.ownedCountries.clear();

    state.players.forEach((player, index) => {
      for (const [countryName, value] of Object.entries(player.holdings)) {
        if (value > 0) {
          owners.set(countryName, index);
          this.ownedCountries.add(countryName);
        }
      }
    });

    for (const country of countries) {
      const view = this.stations.get(country.name);
      if (!view) continue;
      const isCurrent = country.name === current;
      const isSelectable = selectable.has(country.name);
      const ownerIndex = owners.get(country.name) ?? -1;

      view.circle.setRadius(isCurrent ? 10 : isSelectable ? 9 : 6);
      view.circle.setFillStyle(isCurrent ? 0xffd35c : isSelectable ? 0x74f5ff : 0xf8f1d2, 1);
      view.circle.setStrokeStyle(isSelectable ? 3 : 2, isSelectable ? 0x0c7189 : 0x34586b, 1);
      view.ring.setStrokeStyle(3, isSelectable ? 0x74f5ff : 0xffd35c, isSelectable || isCurrent ? 0.85 : 0);
      view.ownerBadge.setFillStyle(ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : 0xffffff, ownerIndex >= 0 ? 1 : 0);
      view.label.setVisible(isCurrent || isSelectable || ownerIndex >= 0);
    }

    this.syncTokens();
    this.updateLabelVisibility();
  }

  private syncTokens(): void {
    this.controller.state.players.forEach((player, index) => {
      const token = this.tokens.get(player.id);
      if (!token) return;
      const point = countryPoint(player.location);
      token.setPosition(point.x + (index - 1.5) * 9, point.y + 22);
      token.setScale(player.id === this.controller.activePlayer.id ? 1.12 : 0.92);
    });
  }

  focusActive(duration = 500): void {
    this.overview = false;
    const player = this.controller.activePlayer;
    const token = this.tokens.get(player.id);
    if (!token) return;
    const zoom = this.localZoom(player.location);
    this.camera.pan(token.x, token.y, duration, "Sine.easeInOut");
    this.camera.zoomTo(zoom, duration, "Sine.easeInOut");
    this.scene.time.delayedCall(duration + 10, () => this.updateLabelVisibility());
  }

  showOverview(): void {
    this.overview = !this.overview;
    if (this.overview) {
      this.camera.pan(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 450, "Sine.easeInOut");
      this.camera.zoomTo(Math.min(this.scene.scale.width / WORLD_WIDTH, this.scene.scale.height / WORLD_HEIGHT) * 0.94, 450, "Sine.easeInOut");
    } else {
      this.focusActive(450);
    }
  }

  animateActiveTokenTo(countryName: string, onComplete: () => void): void {
    const token = this.tokens.get(this.controller.activePlayer.id);
    if (!token) {
      onComplete();
      return;
    }

    const target = countryPoint(countryName);
    const wrappedTargetX = nearestWrappedX(target.x, token.x);
    const targetY = target.y + 22;
    const distance = Phaser.Math.Distance.Between(token.x, token.y, wrappedTargetX, targetY);
    const duration = Phaser.Math.Clamp(distance * 1.35, 260, 720);
    const crossesDateLine = wrappedTargetX < 0 || wrappedTargetX > WORLD_WIDTH;

    this.scene.tweens.add({
      targets: token,
      x: wrappedTargetX,
      y: targetY,
      duration,
      ease: "Sine.easeInOut",
      onUpdate: () => this.camera.centerOn(Phaser.Math.Clamp(token.x, 0, WORLD_WIDTH), token.y),
      onComplete: () => {
        if (crossesDateLine) {
          token.setPosition(target.x, targetY);
          this.camera.centerOn(target.x, targetY);
        }
        onComplete();
        this.refresh();
      },
    });
  }

  private localZoom(countryName: string): number {
    const center = countryPoint(countryName);
    const points = [countryName, ...neighborsOf(countryName).map((n) => n.country)].map((name) => countryPoint(name));
    let maxDx = 0;
    let maxDy = 0;
    for (const point of points) {
      const x = nearestWrappedX(point.x, center.x);
      maxDx = Math.max(maxDx, Math.abs(x - center.x));
      maxDy = Math.max(maxDy, Math.abs(point.y - center.y));
    }
    const neededWidth = Math.max(420, maxDx * 2 + 240);
    const neededHeight = Math.max(300, maxDy * 2 + 210);
    return Phaser.Math.Clamp(Math.min(this.scene.scale.width / neededWidth, this.scene.scale.height / neededHeight), 0.8, 2.45);
  }

  private updateLabelVisibility(): void {
    const showAllNearby = this.camera.zoom > 1.45;
    const current = this.controller.activePlayer.location;
    const selectable = new Set(this.controller.state.phase === "moving" ? this.controller.activeNeighbors : []);
    for (const country of countries) {
      const view = this.stations.get(country.name);
      if (!view) continue;
      view.label.setVisible(showAllNearby || country.name === current || selectable.has(country.name) || this.ownedCountries.has(country.name));
    }
  }
}
