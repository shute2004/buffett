import countriesCsv from "../data/countries.csv?raw";
import adjacencyCsv from "../data/adjacency.csv?raw";
import worldCountries from "world-countries";
import type { Country, Neighbor, RiskClass } from "./types";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(csv: string): string[][] {
  return csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

export function parseRoulette(text: string): number[] {
  const values = Array<number>(10).fill(Number.NaN);
  for (const segment of text.split(";")) {
    const [rangeText, percentText] = segment.split(":");
    if (!rangeText || percentText === undefined) throw new Error(`不正なルーレット表記: ${text}`);
    const [startText, endText] = rangeText.split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : start;
    const percent = Number(percentText.replace("%", "").replace("+", ""));
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 10 || start > end) {
      throw new Error(`不正なルーレット範囲: ${segment}`);
    }
    if (!Number.isFinite(percent)) throw new Error(`不正なルーレット変動率: ${segment}`);
    for (let value = start; value <= end; value += 1) values[value - 1] = percent;
  }
  if (values.some((value) => Number.isNaN(value))) {
    throw new Error(`1〜10をすべて定義していないルーレット: ${text}`);
  }
  return values;
}

function asRiskClass(value: string): RiskClass {
  if (value === "安定" || value === "中間" || value === "不安定") return value;
  throw new Error(`未知の治安・政治リスク分類: ${value}`);
}

function loadCountries(): Country[] {
  const rows = parseCsv(countriesCsv);
  const [header, ...body] = rows;
  const index = Object.fromEntries(header.map((name, i) => [name, i])) as Record<string, number>;
  const get = (row: string[], name: string) => row[index[name]] ?? "";
  const geoByIso3 = new Map(worldCountries.map((country) => [country.cca3, country]));

  const countries = body.map((row) => {
    const iso3 = get(row, "ISO3");
    const geo = geoByIso3.get(iso3);
    if (!geo) throw new Error(`地理座標が見つかりません: ${iso3}`);
    return {
      name: get(row, "国名"),
      iso2: get(row, "ISO2"),
      iso3,
      region: get(row, "地域"),
      rank: Number(get(row, "193カ国内順位")),
      stabilityPercentile: Number(get(row, "WGI_政治安定性パーセンタイル_2024")),
      riskClass: asRiskClass(get(row, "治安・政治リスク分類")),
      cashEvent: Number(get(row, "固定現金イベント_USD")),
      industry: get(row, "主要産業"),
      rouletteText: get(row, "投資ルーレット"),
      roulette: parseRoulette(get(row, "投資ルーレット")),
      expectedReturn: Number(get(row, "投資期待変化率_参考")),
      latitude: geo.latlng[0],
      longitude: geo.latlng[1],
      flag: geo.flag,
    } satisfies Country;
  });

  if (countries.length !== 193) throw new Error(`国データは193カ国必要です。現在: ${countries.length}`);
  if (!countries.some((country) => country.name === "日本")) throw new Error("開始地点の日本が国データにありません");
  return countries;
}

function loadAdjacency(): Map<string, Neighbor[]> {
  const rows = parseCsv(adjacencyCsv);
  const [, ...body] = rows;
  const graph = new Map<string, Neighbor[]>();
  const add = (from: string, to: string, kind: string) => {
    const current = graph.get(from) ?? [];
    if (!current.some((neighbor) => neighbor.country === to)) {
      current.push({ country: to, kind });
      current.sort((a, b) => a.country.localeCompare(b.country, "ja"));
      graph.set(from, current);
    }
  };
  for (const [countryA, countryB, kind] of body) {
    if (!countryA || !countryB) continue;
    add(countryA, countryB, kind || "接続");
    add(countryB, countryA, kind || "接続");
  }
  return graph;
}

export const countries = loadCountries();
export const countryByName = new Map(countries.map((country) => [country.name, country]));
export const adjacency = loadAdjacency();
export function neighborsOf(countryName: string): Neighbor[] {
  return adjacency.get(countryName) ?? [];
}
