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

## PWAインストール

Web App Manifest、Service Worker、192px/512pxアイコンを含んでいます。Cloudflare PagesなどHTTPS環境で公開すると、Android ChromeでPWAとしてインストールできます。

更新直後に「ホーム画面に追加」しか表示されない場合は、Chromeでページを再読み込みし、時間を置いてからメニューまたは画面上部の「インストール」ボタンを確認してください。

## 注意

このアプリは概算シミュレーションです。実際の条件は各金融機関の公式ページをご確認ください。
