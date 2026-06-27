# 金利取得Worker v9

## 構成

- Pages Functions `GET /api/rates`: KVキャッシュを最優先で返す。未設定/未生成のときは安全側にライブ取得へフォールバックする（v8で導入済み）。
- Pages Functions `POST /api/rates`: 画面の「再取得」用。10分ロック付き。
- 独立Worker: 毎日06:00 JST（21:00 UTC）に14系統で銀行を更新する。
  - 主系統（公式構造化API / 公式HTML / 価格.comランキング / 価格.com銀行別 / ダイヤモンド不動産）に加え、v9で**モゲチェック・ZUU online・Wayback Machine・前月KV履歴・Browser Rendering**の5つの補助系統が動く。
- KV `RATE_CACHE`: 銀行別最新値、当月履歴、最後の正常値、失敗理由を共有する。
- Cloudflare Browser Rendering binding `BROWSER`（任意）: 静的HTMLでは取得不能な銀行だけに対して、Cron Worker内のみJS実行付き取得を試みる。

## 初回設定（Cloudflareダッシュボード手順）

### 1. KV namespace の作成

ローカルにwranglerが入っている場合：

```bash
npx wrangler kv namespace create RATE_CACHE
npx wrangler kv namespace create RATE_CACHE --preview
```

返却される `id` と `preview_id` をメモする。

ダッシュボードから作る場合：Workers & Pages → KV → `Create a namespace` → 名前 `RATE_CACHE` を入力 → 作成 → 一覧の右側に出るIDをコピー。Preview用も同じ手順でもう一つ作成する。

### 2. `worker/wrangler.jsonc` の置換

```jsonc
"kv_namespaces": [
  {
    "binding": "RATE_CACHE",
    "id": "実IDをここに貼り付け",
    "preview_id": "preview用IDをここに貼り付け"
  }
]
```

`00000000000000000000000000000000` のままだとデプロイ時にエラーで止まる。

### 3. Pages 側へのバインド

Cloudflare Dashboard → Pages → `mortgage-rate-checker-github` → Settings → Functions → KV namespace bindings：

- Variable name: `RATE_CACHE`
- KV namespace: 上で作った namespace を Production / Preview 両方に紐づける

これを忘れると `GET /api/rates` がキャッシュを参照できず、毎リクエスト都度ライブ取得になり遅延する。

### 4. （任意）Browser Rendering binding

公式HTMLがJS依存の銀行に効く。Workers Paid プラン以上が必要。

Workers & Pages → 対象Worker（`mortgage-rate-checker-rates`） → Settings → Bindings → Add → `Browser Rendering` を選び、Variable name `BROWSER` で保存する。

`worker/wrangler.jsonc` 側は以下を有効化する（v9でコメント付きで同梱済み）：

```jsonc
"browser": { "binding": "BROWSER" }
```

binding が無い場合、コードは Browser Rendering をスキップして他のフォールバックだけで動く。コードの修正は不要。

### 5. Worker のデプロイ

```bash
npm run worker:types
npm run worker:check
npx wrangler deploy --config worker/wrangler.jsonc
```

`worker:check` は dry-run。本デプロイは `wrangler deploy` で行う。

### 6. 動作確認

```bash
curl https://mortgage-rate-checker-github.pages.dev/api/rates | jq '.cached, .items | length, [.items[] | select(.rate!=null)] | length'
```

- `cached: true` がKV経由で返っている証拠
- `items | length` が14（銀行数）になる
- `rate!=null` の件数がトータルに近いほど良い

翌朝06:00 JST以降に値が「公式構造化データ3、複数照合多数」になっていれば成功。

## 保存キー

| キー | 内容 |
|---|---|
| `rates:latest` | 画面へ返す全銀行の最新結果 |
| `rates:latest:{bankId}` | 銀行別の最後の取得値 |
| `rates:history:{YYYY-MM}:{bankId}` | 月次履歴（400日TTL） |
| `rates:refresh-lock` | 重複取得防止（600秒TTL） |

KVは結果キャッシュであり強整合ロックではない。完全に直列化する用途へ拡張する場合は Durable Object へ移行する。

## v9で増えた取得系統と優先順位

主系統が全敗した銀行に対して、Cron Worker内で以下の順に補助系統を試す：

1. **モゲチェック銀行別記事** — 静的HTMLに当月の借換え・変動金利が並ぶ記事をAlias検索で抽出。総合サイト参考値扱い。
2. **ZUU online 月次まとめ** — 「住宅ローン金利 比較 YYYY年M月」系の記事から当月行を抽出。総合サイト参考値扱い。
3. **Wayback Machine スナップショット** — 公式URLの当月スナップショットを `archive.org/wayback/available` 経由で取得し、通常の公式HTMLアダプタで再パース。`official-html` 扱い・要確認。
4. **前月のKV履歴** — `rates:history:{前月}:{bankId}` を読み、stale（前月値）として表示する。**推薦対象外**で UI上は淡色化される。
5. **Cloudflare Browser Rendering** — `BROWSER` binding が設定されている場合のみ、公式URLをJS実行付きで取得して再パース。

優先度：公式API > 公式HTML > 価格.com系 > ダイヤモンド > モゲチェック/ZUU > Wayback > 前月履歴 > Browser Rendering。

## 推薦条件

- 当月の公式API/公式アダプタ値か、公式URL・確認日・適用年月を登録した手入力値
- 生年月日、概算物件価値、残期間、団信条件から条件適合金利を算定可能
- 総合サイト参考値、前月値、汎用HTML診断値、Wayback値、条件不足値は推薦対象外

価格.comはShift_JISで復号する。広島銀行はダイヤモンド不動産の最新月表を参考表示するが、公式確認済み手入力になるまで推薦しない。
