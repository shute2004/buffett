import fs from "node:fs";

const readLines = (path) => fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/);
const countryLines = readLines("data/countries.csv");
const adjacencyLines = readLines("data/adjacency.csv");

const header = countryLines[0].split(",");
const nameIndex = header.indexOf("国名");
const rouletteIndex = header.indexOf("投資ルーレット");
if (nameIndex < 0 || rouletteIndex < 0) throw new Error("countries.csv の必須列がありません");

const countries = countryLines.slice(1).map((line) => line.split(","));
if (countries.length !== 193) throw new Error(`countries.csv: 193カ国必要ですが ${countries.length} 件です`);

const names = new Set(countries.map((row) => row[nameIndex]));
if (names.size !== 193) throw new Error("countries.csv: 国名が重複しています");
if (!names.has("日本")) throw new Error("countries.csv: 日本がありません");

function parseRoulette(roulette, countryName) {
  const outcomes = [];
  const coveredFaces = new Set();

  for (const rawSegment of roulette.split(";")) {
    const segment = rawSegment.trim();
    const match = segment.match(/^(\d+)(?:-(\d+))?:([+-]?\d+(?:\.\d+)?)%$/);
    if (!match) throw new Error(`${countryName}: 不正なルーレット形式: ${segment}`);

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    const value = Number(match[3]);
    if (!Number.isFinite(value) || start < 1 || end > 10 || start > end) {
      throw new Error(`${countryName}: 不正なルーレット範囲または値: ${segment}`);
    }

    for (let face = start; face <= end; face += 1) {
      if (coveredFaces.has(face)) throw new Error(`${countryName}: ルーレット目 ${face} が重複しています`);
      coveredFaces.add(face);
    }
    outcomes.push(value);
  }

  if (coveredFaces.size !== 10 || [...coveredFaces].some((face) => face < 1 || face > 10)) {
    throw new Error(`${countryName}: ルーレットは1〜10を重複なく全てカバーする必要があります`);
  }
  if (!outcomes.some((value) => value > 0)) {
    throw new Error(`${countryName}: プラスのルーレット目がありません`);
  }
  if (!outcomes.some((value) => value < 0)) {
    throw new Error(`${countryName}: マイナスのルーレット目がありません`);
  }

  return outcomes;
}

for (const row of countries) {
  parseRoulette(row[rouletteIndex] ?? "", row[nameIndex]);
}

const connected = new Set();
for (const line of adjacencyLines.slice(1)) {
  const [a, b] = line.split(",");
  if (!names.has(a) || !names.has(b)) throw new Error(`adjacency.csv: 未知の国 ${a} / ${b}`);
  connected.add(a);
  connected.add(b);
}
const isolated = [...names].filter((name) => !connected.has(name));
if (isolated.length) throw new Error(`adjacency.csv: 接続のない国: ${isolated.join("、")}`);

console.log(`Validated ${countries.length} countries and ${adjacencyLines.length - 1} adjacency edges.`);
