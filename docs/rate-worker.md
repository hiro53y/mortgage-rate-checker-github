# 金利取得Worker v7

## 構成

- Pages Functions `GET /api/rates`: KVの最新キャッシュだけを返す
- Pages Functions `POST /api/rates`: 画面の「再取得」用。10分ロック付き
- 独立Worker: 毎日06:00 JST（21:00 UTC）に13銀行を更新
- KV `RATE_CACHE`: 銀行別最新値、当月履歴、最後の正常値、失敗理由を共有

## 初回設定

1. `npx wrangler kv namespace create RATE_CACHE` を実行する。
2. 返されたnamespace IDを `worker/wrangler.jsonc` へ設定する。
3. Cloudflare PagesのProduction/Previewにも同じnamespaceを、名前 `RATE_CACHE` でDashboardからバインドする。
4. `npm run worker:types`、`npm run worker:check` を実行する。
5. `npx wrangler deploy --config worker/wrangler.jsonc` でWorkerをデプロイする。

Worker設定の `00000000000000000000000000000000` は検証用プレースホルダーであり、本番デプロイ前に必ず置換する。Pages用設定には仮IDを置かず、Git連携デプロイを阻害しない。

## 保存キー

| キー | 内容 |
|---|---|
| `rates:latest` | 画面へ返す全銀行の最新結果 |
| `rates:latest:{bankId}` | 銀行別の最後の取得値 |
| `rates:history:{YYYY-MM}:{bankId}` | 当月履歴（400日TTL） |
| `rates:refresh-lock` | 重複取得防止（600秒TTL） |

KVは結果キャッシュに使用する。強整合ロックではないため、Cronの重複実行を完全に直列化する用途へ拡張する場合はDurable Objectへ移行する。

## 推薦条件

- 当月の公式API/公式アダプタ値か、公式URL・確認日・適用年月を登録した手入力値
- 生年月日、概算物件価値、残期間、団信条件から条件適合金利を算定可能
- 総合サイト参考値、前月値、汎用HTML診断値、条件不足値は推薦対象外

価格.comはShift_JISで復号する。モゲチェックは銀行別静的金利がないため、数値フォールバックには使用しない。広島銀行はダイヤモンド不動産の最新月表を参考表示するが、公式確認済み手入力になるまで推薦しない。
