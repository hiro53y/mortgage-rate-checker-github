# 金利取得Worker v12

## 構成と責務

- Pages Functions `GET /api/rates`: `RATE_CACHE` がJST当月かつ取得日時正常なら返す。月違い・日時不正・未来日時ならライブ再取得し、失敗時だけ旧値を全行staleで返す。
- Pages Functions `POST /api/rates`: 画面の「再取得」用。10分ロック付き。
- 独立Worker `mortgage-rate-checker-rates`: 毎日06:00 JST（Cron `0 21 * * *`、UTC）に銀行金利を更新し、同じ `RATE_CACHE` へ保存する。
- 独立Workerは `workers_dev: false` かつrouteなしのCron専用です。手動更新はPages Functionsを使い、将来Workerへrouteを追加する場合も `REFRESH_TOKEN` secretが未設定ならPOSTを拒否します。
- KV `RATE_CACHE`: 全銀行payloadと、検証済み公式値だけの銀行別最新値・月次履歴を共有する。KVは結果キャッシュであり、強整合ロックではない。
- Browser Rendering binding `BROWSER` は任意。静的HTMLで取得不能な銀行だけに、Cron Worker内でJS実行付き取得を試す。

`worker/wrangler.jsonc` は独立WorkerとCronの正本です。CronはWrangler設定でだけ管理してください。WorkerをWranglerで再デプロイすると、既存のCron設定は `triggers.crons` の内容に置き換わります。

Pagesは公開済みのGit連携プロジェクト `mortgage-rate-checker-github` です。Pages FunctionsのKV bindingはCloudflare Dashboardで設定し、Production/Previewを別namespaceへ接続します。WorkerのKV設定だけではPages Functionsにbindingされません。

## 本番デプロイの範囲外（v12第1段階）

このリポジトリにはまだ全ゼロのKV placeholderを残しています。v12第1段階は事前ガードと運用手順の整備までであり、以下は実行しません。

- Cloudflare上のKV namespace作成
- Pagesのbinding追加・Pages再デプロイ
- 独立Worker/Cronの本番デプロイ
- Browser Renderingの有効化

`npm run worker:deploy` は、実IDが設定されるまで必ず停止します。IDを設定しないまま `npx wrangler deploy --config worker/wrangler.jsonc` を直接実行しないでください。

## 実デプロイ前に必要なもの

1. 対象Cloudflare accountと、Pages project `mortgage-rate-checker-github` の設定変更権限。
2. Production用とPreview用で別々のKV namespace ID（各32桁16進）。
3. Worker/KVを操作できる認証。対話利用は `npx wrangler login`、CIは一時的な `CLOUDFLARE_API_TOKEN` を使い、tokenをリポジトリへ保存しない。
4. 最小権限の目安は account scope の `Workers Scripts Write`（Worker/Cronデプロイ）と `Workers KV Storage Write`（namespace作成・KV操作）。Pages bindingは対象PagesプロジェクトのSettingsを変更できるCloudflare roleが必要です。

アカウントを確認します。

```powershell
npx wrangler whoami
```

複数アカウントで曖昧になる場合だけ、確認済みの非secret account IDを `worker/wrangler.jsonc` に設定してください。

独立WorkerはCron専用のため、通常はrouteや `workers.dev` URLを公開しません。運用上どうしてもWorkerの `POST /api/rates/refresh` を公開する場合だけ、先に `npx wrangler secret put REFRESH_TOKEN --config worker/wrangler.jsonc` で十分に長いsecretを登録し、同じ値を `x-refresh-token` headerで送ります。secret未設定・空値・不一致はいずれも401です。

## ユーザーがCloudflareで実施する初回設定

### 1. KV namespaceをProduction/Preview別に作成

認証済みのリポジトリrootで実行します。これはCloudflareアカウントに実リソースを作成する操作です。

```powershell
npx wrangler kv namespace create RATE_CACHE
npx wrangler kv namespace create RATE_CACHE --preview
```

返却されたProduction用 `id` とPreview用 `preview_id` を記録します。ダッシュボードで作成しても構いませんが、同じnamespaceをProduction/Previewで共用しません。

### 2. Worker設定に実IDを設定

`worker/wrangler.jsonc` の次の値だけを置換します。

```jsonc
"kv_namespaces": [
  {
    "binding": "RATE_CACHE",
    "id": "Production用の32桁ID",
    "preview_id": "Preview用の別の32桁ID"
  }
]
```

`npm run worker:deploy` は次の場合に非0で停止します。

- `id` または `preview_id` が全ゼロplaceholder
- IDが32桁16進でない
- Production/PreviewのIDが同一

### 3. Pagesに同じbinding名を設定

Cloudflare Dashboard → Workers & Pages → `mortgage-rate-checker-github` → Settings → Bindings でKV namespace bindingを追加します。

| 環境 | Variable name | 接続先 |
| --- | --- | --- |
| Production | `RATE_CACHE` | Production用namespace |
| Preview | `RATE_CACHE` | Preview用namespace |

bindingの反映にはPagesの再デプロイが必要です。Git連携PagesではDashboardのbindingを確認の正とし、WorkerだけをデプロイしてもPages側設定は変わりません。

停止ガードが機械検証するのは `worker/wrangler.jsonc` 内のKV IDだけです。対象account、Pages project、Dashboard側Production/Preview bindingの存在と接続先は検証できないため、上表をデプロイ前の手動承認ゲートとして必ず確認してください。

## ローカル検証と安全なデプロイ

実IDを設定後、本番更新前に実行します。

```powershell
npm run worker:types
npm run worker:check
node scripts/validate-worker-config.mjs
```

`worker:check` は `wrangler deploy --dry-run` のままで、本番Worker/Cronを作成しません。`worker:deploy` だけが、KV IDガード成功後に本番デプロイを実行します。

```powershell
npm run worker:deploy
```

本番デプロイは、Cloudflare上のWorkerとCronを更新する操作です。Production/Preview別ID、Cron、Pages bindingを確認し、明示的な承認がある場合だけ実行してください。

## デプロイ後の確認（PowerShell）

Cron実行後（次回06:00 JST以降）に、公開APIがKVを返しているか確認します。

```powershell
$result = Invoke-RestMethod "https://mortgage-rate-checker-github.pages.dev/api/rates"
$result.cached
$result.items.Count
@($result.items | Where-Object { $null -ne $_.rate }).Count
```

期待値は `cached` が `True`、`items.Count` が13、金利あり件数が総数に近いことです。KVは結果キャッシュで最終一貫性のため、Cron直後の一回だけで成否を判定せず、WorkerのObservabilityログと合わせて確認してください。

## ロールバック時の注意

- 直前に正常だった `worker/wrangler.jsonc` を復元してから `npm run worker:deploy` を実行し、Worker/Cronを設定ごと戻します。
- `triggers.crons: []` でのデプロイは全Cronを削除します。障害対応以外で空配列を使わず、cronキーをコメントアウトして無効化しないでください（既存Cronが残る可能性があります）。
- KVを削除すると履歴・最後の正常値・ロックが失われます。まずWorkerを停止または以前の設定へ戻し、KV削除は影響を理解した上で別途承認を得て実施してください。

## Browser Rendering（任意・後続段階）

Workers Paidプラン以上で、JS依存の公式ページを補助取得したい場合だけ有効化します。Cloudflare Dashboardで対象WorkerにBrowser Rendering bindingを追加し、Variable nameを `BROWSER` にします。その後、`worker/wrangler.jsonc` のコメントを外します。

```jsonc
"browser": { "binding": "BROWSER" }
```

bindingがない場合はコードがBrowser Renderingをスキップし、他のフォールバックで動作します。

## 保存キーと取得優先順位

| キー | 内容 |
|---|---|
| `rates:latest` | 画面へ返す全銀行の最新結果 |
| `rates:verified-latest:{bankId}` | 銀行別の最後の検証済み公式値 |
| `rates:verified-history:{YYYY-MM}:{bankId}` | 当時のJST当月に確認できた検証済み公式値（400日TTL） |
| `rates:refresh-lock` | 重複取得防止（600秒TTL） |

旧 `rates:latest:{bankId}` / `rates:history:{YYYY-MM}:{bankId}` は読み取り互換だけを残します。公式由来、`verified`、正の有限金利、対象月一致、正常かつ未来でない取得日時を満たす値だけを新キーへ移行し、aggregator・review・月違い値は移行しません。

旧payloadがない初回取得で全銀行が失敗した場合は、失敗結果を `rates:latest` に保存しません。応答はstaleとして返し、次の通常GETでライブ取得を再試行します。

公式API > 公式HTML > 価格.com系 > ダイヤモンド > モゲチェック/ZUU > Wayback > 前月履歴 > Browser Rendering の順で利用します。前月履歴、総合サイト参考値、Wayback値、条件不足値は借換え推薦の対象外です。
