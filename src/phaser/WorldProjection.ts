import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { countryByName } from "../data";

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1200;
const MAP_TEXTURE_SCALE = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);

export interface WorldPoint {
  x: number;
  y: number;
}

const projection = geoEquirectangular()
  .scale(WORLD_WIDTH / (2 * Math.PI))
  .translate([WORLD_WIDTH / 2, WORLD_HEIGHT / 2]);

const topology = world as unknown as { objects: { land: object } };
const land = feature(world as never, topology.objects.land as never);

export function countryPoint(countryName: string): WorldPoint {
  const country = countryByName.get(countryName);
  if (!country) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  const point = projection([country.longitude, country.latitude]);
  if (!point) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  return { x: point[0], y: point[1] };
}

export function nearestWrappedX(canonicalX: number, referenceX: number): number {
  let best = canonicalX;
  let distance = Math.abs(canonicalX - referenceX);
  for (const offset of [-WORLD_WIDTH, WORLD_WIDTH]) {
    const candidate = canonicalX + offset;
    const candidateDistance = Math.abs(candidate - referenceX);
    if (candidateDistance < distance) {
      best = candidate;
      distance = candidateDistance;
    }
  }
  return best;
}

export function createWorldMapCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WORLD_WIDTH * MAP_TEXTURE_SCALE);
  canvas.height = Math.round(WORLD_HEIGHT * MAP_TEXTURE_SCALE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("世界地図用Canvas 2D Contextを作成できません");

  context.scale(MAP_TEXTURE_SCALE, MAP_TEXTURE_SCALE);
  context.fillStyle = "#58a7c7";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.beginPath();
  const path = geoPath(projection, context);
  path(land as never);
  context.fillStyle = "#d7d99f";
  context.fill();
  context.strokeStyle = "#95a36c";
  context.lineWidth = 2;
  context.stroke();

  return canvas;
}
