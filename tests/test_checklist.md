# テストチェックリスト

## 2026-06-26 v10

- [x] 第1優先：公式条件適合金利が `getEstimatedRate` から `official-condition-matched` で返る
- [x] 第2優先：aggregator 由来の `advertisedMinRate` が `aggregator-reference` ラベルで返る
- [x] 第3優先：公式HTML系で団信不明な場合 `advertisedMinRate + 0.3%` が `estimated-with-insurance` ラベルで返る
- [x] `INSURANCE_ADDON_ESTIMATE` 定数が +0.3% である
- [x] 第4優先：広告下限が無い場合 `expectedVariableRateRange` 中央値が `estimated-midrange` ラベルで返る
- [x] 第4優先：source が無くても落ちずに `effectiveRate` が返る
- [x] 第3・4優先・第2優先（aggregator）は `isLatestFetchedCandidate` で false（推薦対象外）
- [x] 第1優先（公式条件適合）は `isLatestFetchedCandidate` で true（推薦対象）
- [x] `recalculateComparisonRow`：rateOffer 無しでも `conditionMatchedRate` が undefined にならない
- [x] `recalculateComparisonRow`：advertisedMinRate のみある場合は +0.3% 推定
- [x] `recalculateComparisonRow`：算定不可状態でも月返済額が必ず計算される
- [x] 比較表（モバイル・デスクトップ）から「算定不可」「未取得」表示が全て消える
- [x] 条件適合金利欄に tier ラベル（条件適合 / 参考値 / 推定値（団信込）/ 推定値（中央レンジ））が表示される
- [x] `schemaVersion: 10` を返す
- [x] 画面ビルド表示が `2026/06/26 v10`
- [x] Service Workerが `mortgage-rate-checker-v10-20260626`
- [x] ルート `npm test`（72件パス）
- [x] ルート `npx tsc -b`
- [x] ルート Functions/Workerの各 `node --check`
- [x] `deliverables/mortgage-rate-checker-github/` の `npm test` / `npx tsc -b` / `node --check`

## 2026-06-25 v9

- [x] モゲチェック銀行別記事から、エイリアス周辺の借換え変動金利を抽出する
- [x] ZUU online 月次まとめは当月を含む記事だけ採用する
- [x] Wayback Machineの当月スナップショットから公式HTMLを再解析できる（実装、ユニットはモック）
- [x] Browser Renderingは `BROWSER` バインディングが無い場合スキップする
- [x] 主系統が全敗してもKV履歴に前月値があれば `stale` として参考表示する
- [x] `stale` 結果は当月履歴に上書きしない（前月値で当月成功を汚さない）
- [x] `getPreviousMonthKey` が年跨ぎを含めて前月キーを返す
- [x] `buildStaleOfferFromHistory` が `confidence: review` と「履歴値」を明記する
- [x] `schemaVersion: 9` を返し、stale/失敗のカウントが画面メッセージに含まれる
- [x] 比較表で `stale`/`failed` 行が淡色化され、当月手入力導線が強調される
- [x] 借換え画面の空状態が「マイローン確認 → 公式値手入力 → 再判定」の4ステップで案内される
- [x] 画面ビルド表示が `2026/06/25 v9`
- [x] Service Workerが `mortgage-rate-checker-v9-20260625`
- [x] ルート `npm test`
- [x] ルート `npx tsc -b`
- [x] ルート Functions/Workerの各 `node --check`
- [x] `deliverables/mortgage-rate-checker-github/` の `npm test` / `npx tsc -b` / `node --check`
- [ ] 本番KV ID設定と独立Cron Workerデプロイ（手順書を `docs/rate-worker.md` に整備済み）
- [ ] Browser Rendering binding の有効化（Workers Paid プラン時のみ）

## 2026-06-24 v8

- [x] KV未設定・キャッシュ未作成のGETがライブ取得へフォールバックする
- [x] GETのキャッシュ未命中でコメントアウト済みv6関数を参照しない
- [x] 住信SBI実JSONPの連続カンマと末尾カンマを解析する
- [x] 公式構造化アダプタ失敗後も総合サイト照合へ継続する
- [x] 価格.comランキングから銀行別の当月借換え変動商品だけを抽出する
- [x] 価格.com銀行別ページから借換え変動商品を構造抽出する
- [x] ダイヤモンド不動産の当月行を使い、過去月の低い金利を採用しない
- [x] 口コミ、手数料、団信上乗せ、固定金利を採用しない
- [x] 公式API、価格.com、ダイヤモンド不動産の証跡を保持する
- [x] 複数情報源一致と単一情報源・要確認を区別する
- [x] 4xxを不要に再試行せず、公式HTML診断を並列・上限時間付きで実行する
- [x] 比較画面に取得元、照合元、適用年月、照合状態を表示する
- [x] 実ページで13/13銀行に当月値が入る（公式3、複数照合8、単一参考2）
- [x] 画面ビルド表示が `2026/06/24 v8`
- [x] Service Workerが `mortgage-rate-checker-v8-20260624`
- [x] ルート `npm test`（52件）
- [x] ルート `npx tsc -b`
- [x] ルート Functions/Workerの各 `node --check`
- [ ] ルート `npm run build`（Viteの子プロセス起動が環境制限 `spawn EPERM`）
- [ ] ルート `npm run worker:check`（Wranglerの子プロセス起動が環境制限 `spawn EPERM`）
- [x] `deliverables/mortgage-rate-checker-github/` の自動テスト・型検査
- [x] GitHub `main` へv8をPushし、Cloudflare Pagesのv8反映を確認
- [x] 公開 `/api/rates` GET/POSTで13/13銀行の取得結果を確認（公式3、複数照合5、単一参考5）
- [ ] 本番KV ID設定と独立Cron Workerデプロイ

## 2026-06-21 v7

- [x] 住信SBI JSONPで借換え変動の融資率80%以下/超を区別する
- [x] PayPay APIで新規・固定ではなく借換え変動金利を採用する
- [x] SBI新生APIで当月の通常・自己資金・SBIハイパー金利を区別する
- [x] 価格.comのShift_JISを復号し、総合サイト参考値として扱う
- [x] 広島銀行の2.20%手数料、0.400%口コミ、固定列、過去月を採用しない
- [x] 融資率80%超、35年超、団信上乗せ不明、年齢超過、条件不足を判定する
- [x] 当月公式条件適合値だけを推薦し、前月値・総合サイト値を除外する
- [x] 公式確認済み手入力だけを推薦候補にできる
- [x] 取得失敗時に最後の正常値を保持する
- [x] Workerの銀行別部分失敗で全体を失敗させない
- [x] KVへ銀行別最新値・当月履歴を保存する
- [x] 10分KVロック中は重複取得しない
- [x] 旧localStorage JSONを読み込み、v7派生値を再計算できる
- [x] 画面ビルド表示が `2026/06/21 v7`
- [x] Service Workerが `mortgage-rate-checker-v7-20260621`
- [x] ルート `npm test`
- [x] ルート `node --check functions/api/rates.js`
- [x] ルート `node --check functions/api/rateAdapters.js`
- [x] ルート `node --check functions/api/rateService.js`
- [x] ルート `node --check worker/src/index.js`
- [x] ルート `npx tsc -b`
- [x] ルート `npm run worker:types`
- [x] ルート `npm run worker:check`
- [ ] ルート `npm run build`（OneDriveのdist削除とesbuild起動がEPERM）
- [x] `deliverables/mortgage-rate-checker-github/` の `npm test`
- [x] `deliverables/mortgage-rate-checker-github/` の各 `node --check`
- [x] `deliverables/mortgage-rate-checker-github/` の `npx tsc -b`
- [ ] `deliverables/mortgage-rate-checker-github/` の `npm run build`（同じ実行環境制限）
- [ ] ローカルViteのスマホ/デスクトップ画面確認（同じ実行環境制限）
- [x] GitHub `main` へv7をPushし、Cloudflare Pages公開URLでv7反映を確認
- [ ] 本番KV ID設定と独立Cron Workerデプロイ

## 2026-06-13

- [x] 住信SBIネット銀行の口コミ欄にある過去年利 0.400% を現在の変動金利として採用しないこと
- [x] 広島銀行の事務手数料・固定金利列・過去月表の数値を現在の変動金利として採用しないこと
- [x] 広島銀行のダイヤモンド不動産研究所ページでは、最新月の変動金利列 0.950% を優先すること
- [x] 住信SBIネット銀行は価格.com/モゲチェックを補助取得先として確認できること
- [x] PayPay銀行・SBI新生銀行・auじぶん銀行が既存保存データでも比較表に補完されること
- [x] PayPay銀行・SBI新生銀行・auじぶん銀行も借換えランキング系ページを補助取得先に含めること
- [x] 画面下部に `更新: 2026/06/13 v6` が表示されること
- [x] Service Workerのキャッシュ名が `mortgage-rate-checker-v6-20260613` であること
- [x] ルート `npm test`
- [x] ルート `node --check functions/api/rates.js`
- [x] ルート `npx tsc -b`
- [x] ルート `npm run build`（通常実行は `EPERM`、権限付き再実行で成功）
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npm test`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `node --check functions/api/rates.js`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npx tsc -b`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npm run build`（通常実行は `EPERM`、権限付き再実行で成功）
- [x] 「交渉優先度は低め」文言が試算画面から消えること
- [x] 現在金利 1.005% と下限 0.950% の判定が「現在金利は下限金利より高い」になること
- [x] 試算画面に判定式 `1.005% - 0.950% = +0.055%` が表示されること
- [x] 比較表の基準が保存済み現在ローン条件であることを表示すること
- [x] 次回返済日が過去日の場合、試算用の次回返済日を未来月へ繰り上げて表示すること
- [x] 比較表に月返済とボーナス返済を分けて表示すること
- [x] 比較表の差額列を「12年累計差（月返済分）」として表示すること
- [x] スマホ比較カードの差額を「12年月返済差」として表示すること
- [x] 借換え画面に現在/候補の月返済・ボーナス返済・総返済額差・諸費用差引後を表示すること
- [x] 借換え候補の総返済額でボーナス返済差も再計算すること
- [x] 借換え候補は最新金利を自動取得できた銀行だけから、判定使用金利が最も低い銀行を選ぶこと
- [x] 自動取得失敗・未取得・サンプル値だけ・手入力だけの銀行を借換え候補にしないこと
- [x] 最新取得済み候補がない場合、借換え画面に候補なしの案内を表示すること
- [x] 金利抽出で `年--%` のプレースホルダーや団信上乗せ率だけを取得成功扱いしないこと
- [x] 住信SBIネット銀行の取得先に `https://www.netbk.co.jp/contents/lp/homeloan/web/re.html` を含めること
- [x] 広島銀行の取得先に `https://www.hirogin.co.jp/service/loan/housing-loan/super/` を含めること
- [x] 公式ページで判断できない場合、モゲチェック・価格.com・ダイヤモンド不動産研究所を総合サイトフォールバックとして確認すること
- [x] 総合サイト抽出で、実質金利より表面金利・適用金利・変動金利を優先すること
- [x] ホームの金額非表示時に返済額確認カード内の金額も非表示になること
- [x] 画面下部に `更新: 2026/06/13 v5` が表示されること
- [x] Service Workerのキャッシュ名が `mortgage-rate-checker-v5-20260613` であること
- [x] 初回設定フォームの保存ボタンが固定フッターに隠れず押せること
- [x] ルート `npm test`
- [x] ルート `npx tsc -b`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npm test`
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npx tsc -b`
- [x] ルート `npm run build`（通常実行は `EPERM`、権限付き再実行で成功）
- [x] `deliverables/mortgage-rate-checker-github/` 内で `npm run build`（通常実行は `EPERM`、権限付き再実行で成功）
- [ ] ローカルVite画面確認（v6では未実施）
- [ ] ローカルViteスマホ幅確認（v6では未実施）
- [ ] 公開URLのv6反映確認（GitHub commit/pushとCloudflare Pages再デプロイ後に実施）

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

- Windows/OneDrive配下では `dist` 削除やVite/esbuild起動が `EPERM` になる場合がある。必要に応じて権限付きで `npm run build` / `npm run dev` を実行する。
- Cloudflare Pages Functions `/api/rates` はCloudflare環境での外部ページ取得が前提。ローカルVite単体ではAPIは存在しないため、画面側は失敗時に前回値/サンプル値へフォールバックする。
