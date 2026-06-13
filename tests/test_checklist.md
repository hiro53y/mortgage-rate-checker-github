# テストチェックリスト

## 2026-06-13

- [x] 「交渉優先度は低め」文言が試算画面から消えること
- [x] 現在金利 1.005% と下限 0.950% の判定が「現在金利は下限金利より高い」になること
- [x] 試算画面に判定式 `1.005% - 0.950% = +0.055%` が表示されること
- [x] 比較表の基準が保存済み現在ローン条件であることを表示すること
- [x] 比較表に月返済とボーナス返済を分けて表示すること
- [x] 比較表の差額列を「12年累計差（月返済分）」として表示すること
- [x] 借換え画面に現在/候補の月返済・ボーナス返済・総返済額差・諸費用差引後を表示すること
- [x] 借換え候補の総返済額でボーナス返済差も再計算すること
- [x] ルート `npm test`
- [x] ルート `npx tsc -b`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npm test`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npx tsc -b`
- [ ] ルート `npm run build`（Vite/esbuild `spawn EPERM` のため未完了）
- [ ] `deliverables/mortgage-rate-checker-github/` 内で `npm run build`（同じく `spawn EPERM` のため未完了）
- [ ] ローカルVite画面確認（同じく `spawn EPERM` のため未完了）

## 2026-06-12

- [x] 1.005%変更時の試算見出しが交渉検討になること
- [x] 現在金利と同じシナリオの年間差額が0円になること
- [x] 下限金利シナリオが現在条件より低い返済額・マイナス年間差額になること
- [x] 試算カード文言が現在条件との関係に応じて分岐すること
- [x] 比較表が現在条件 1.005% / 月返済 90,916円基準で再計算されること
- [x] 借換え画面が最良候補と現在条件基準を表示すること
- [x] Service Workerの旧cache-first挙動を避け、ローカル検証で新コードが表示されること
- [x] ルート `npm test`
- [x] ルート `npm run build`
- [x] ローカルVite画面確認（試算、比較、借換え）

## 2026-06-07

- [x] 1.005%変更時の交渉判定メッセージテスト
- [x] 現在条件基準の比較表再計算テスト
- [x] 借換え最良候補の自動選択テスト
- [x] 返済額未更新警告のテスト
- [x] ルート `npm test`
- [x] ルート `npm run build`
- [x] ローカルVite画面確認（1.005% / 返済額旧値の警告、試算文言、比較表、借換え画面）
- [x] `deliverables/mortgage-rate-checker-current-basis-20260607/` 内で `npm install`
- [x] `deliverables/mortgage-rate-checker-current-basis-20260607/` 内で `npm test`
- [x] `deliverables/mortgage-rate-checker-current-basis-20260607/` 内で `npm run build`

## 2026-05-06

- [x] 元利均等返済額の計算テスト
- [x] 残月数の計算テスト
- [x] 年間増加額の計算テスト
- [x] 金利差と交渉判定のテスト
- [x] 借換え実質メリット、毎月差額、回収期間、判定のテスト
- [x] 比較表の金利優先順位と再計算テスト
- [x] ルート `npm test`
- [x] ルート `npm run build`
- [x] `dist/` のHTTP 200起動相当チェック
- [x] `deliverables/mortgage-rate-checker/` 内で `npm install`
- [x] `deliverables/mortgage-rate-checker/` 内で `npm test`
- [x] `deliverables/mortgage-rate-checker/` 内で `npm run build`
- [x] ホーム画面金額マスク改修後の `npm test`
- [x] ホーム画面金額マスク改修後の `npm run build`

## 注意

- Vite dev serverのバックグラウンド起動はCodex実行ポリシーでブロックされたため、常駐サーバーURLの提示は未実施。
- Cloudflare Pages Functions `/api/rates` はCloudflare環境での外部ページ取得が前提。ローカルVite単体ではAPIは存在しないため、画面側は失敗時に前回値/サンプル値へフォールバックする。
