# テストチェックリスト

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
