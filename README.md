# 住宅ローン金利チェッカー

## 概要

住宅ローン条件、金利変更シナリオ、主要銀行比較、借換えメリットを確認するスマホ向けWebアプリです。

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run dev
```

Windowsでは `start-dev.bat` でも起動できます。

## テスト

```bash
npm test
```

## ビルド

```bash
npm run build
```

Windowsでは `build.bat` でも実行できます。

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Functions directory: `functions`

月次取得結果を端末間で共有する場合は、Cloudflare KV namespaceを作成し、PagesのFunctions設定で `RATE_CACHE` という名前でバインディングしてください。未設定でも動きますが、キャッシュは端末側中心になります。

## 金利自動取得と手入力補正

- 毎月10日以降、銀行比較表を開いたときに当月未チェックなら `/api/rates` で公式ページから金利候補を取得します。
- 自動取得値は誤取得の可能性があるため、各行の「公式を開く」で確認してください。
- 自動取得値が違う場合は「手入力補正」に正しい金利を入力し、「再判定」を押してください。
- 判定の優先順位は `手入力補正値 > 自動取得値 > サンプル値` です。
- 表示と判定は概算です。実際の適用条件は各金融機関で確認してください。

## PWAインストール

Web App Manifest、Service Worker、192px/512pxアイコンを含んでいます。Cloudflare PagesなどHTTPS環境で公開すると、Android ChromeでPWAとしてインストールできます。

更新直後に「ホーム画面に追加」しか表示されない場合は、Chromeでページを再読み込みし、時間を置いてからメニューまたは画面上部の「インストール」ボタンを確認してください。

## 注意

このアプリは概算シミュレーションです。実際の条件は各金融機関の公式ページをご確認ください。
