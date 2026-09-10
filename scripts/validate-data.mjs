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

for (const row of countries) {
  const name = row[nameIndex];
  const roulette = row[rouletteIndex] ?? "";
  if (!roulette.includes("+")) throw new Error(`${name}: プラスのルーレット目がありません`);
  if (!roulette.includes("-")) throw new Error(`${name}: マイナスのルーレット目がありません`);
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
