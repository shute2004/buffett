# Buffett

Buffett（バフェット）は、国連加盟193カ国を盤面にした投資テーマの人生ゲーム型ボードゲームです。

名前は投資家 Warren Buffett に由来しますが、本人、Berkshire Hathaway、その他の関連組織とは無関係です。

## 概要

少ないルールから、分散投資・集中投資・地域リスク・流動性・借金・対人戦といった要素が自然に現れるゲームを目指して実装しています。

各国にはゲーム用の固定現金イベント、主要産業、1〜10の投資ルーレットを設定し、世界地図上の隣接グラフを1マスずつ移動します。

## 技術構成

- TypeScript 5.9 — ルールと進行制御
- Phaser 4.2.1 — 盤面描画、入力、カメラ、Tween、HUD、ルーレット
- Vite 7 — 開発サーバーと本番ビルド
- D3 Geo / world-atlas — 世界地図の投影と地形描画
- world-countries — 国の座標・旗等の地理情報
- Web Audio API — 外部音源を使わない効果音
- Vitest — UI非依存のルール・進行テスト
- Playwright — ブラウザ起動とゲーム開始のE2Eテスト

## 実装済みの主な機能

- 同一端末で2〜4人対戦
- 1〜100年のプレイ期間
- 日本から開始
- 世界地図上の193カ国と隣接移動
- Phaser Tweenによる駒移動とカメラ追従
- 固定現金イベント
- 国別の投資ルーレット
- 所有国での対人戦
- ターン開始時の株式売却
- 支払い不足時の自動借金
- 年末返済と返済不能時の全株式差し押さえ
- 最終純資産による順位
- Web Audio APIによる効果音

## アーキテクチャ

- `src/game.ts` — UI非依存のルールエンジン
- `src/controller/GameController.ts` — ターン、月、年、移動、到着、決算の進行制御
- `src/data.ts` — 193カ国データと隣接グラフの読み込み・検証
- `src/phaser/BoardView.ts` — 世界地図、国マス、経路、駒、カメラ
- `src/phaser/scenes/` — 開始画面、ゲーム画面、HUD、最終結果
- `src/phaser/services/AudioService.ts` — Web Audio APIによる効果音
- `tests/` — ルール、進行、ブラウザ起動テスト

## 開発

```bash
npm install
npm run dev
```

検証:

```bash
npm test
npm run build
npm run test:e2e
```

`npm run build` は、国データ検証、TypeScriptの型検査、Viteの本番ビルドを実行します。

GitHub Actionsでもunit test、build、Chromium上のPlaywright E2Eを実行します。

## データについて

`data/countries.csv` はゲーム用に設計した派生データです。政治安定性の順位・パーセンタイルおよび固定現金イベントの初期設計には World Bank の Worldwide Governance Indicators (WGI) 2024 を参考にし、主要産業と投資ルーレットの設計には World Bank の2023/2024年の広域産業情報と各国事情を参考にしています。

これらの値はゲームバランス用のパラメータであり、投資判断や各国の現在の経済状況を示す権威的データではありません。

地図形状はnpm依存の `world-atlas`、座標・国旗等は `world-countries` を実行時に利用します。隣接グラフ `data/adjacency.csv` はゲーム盤面用に整理した接続関係です。

## License

Source-visible, all rights reserved. See [LICENSE](LICENSE). Copying, modification, redistribution, commercial use, and derivative works are not permitted without explicit permission except where applicable law or platform terms require otherwise.
