# タスク管理

## 未着手

なし

## 作業中

- [ ] 本番KV IDを設定し、独立Cron Workerをデプロイする（未設定時のライブ取得フォールバックは実装済み。手順書は `docs/rate-worker.md`）
- [ ] （任意）Workers Paid を有効化し、Worker に `BROWSER` binding を追加する（JS依存銀行向けのv9補助系統）

## 完了

- [x] v12精度改善: 年月・日付判定を `Asia/Tokyo` に統一し、JST月境界テストを追加
- [x] v12精度改善: 手入力推薦を正の有限金利・有効な確認日時・JST当月・HTTPS・登録済み公式host一致に限定
- [x] v12精度改善: 前月・未入力・不正年月・非公式host・stale値を保持したまま参考表示へ降格し、★/借換え候補から除外
- [x] v12精度改善: `rates:latest` のfresh/stale判定、stale時ライブ再取得、失敗時の旧証跡付き全行stale応答を実装
- [x] v12精度改善: `rates:verified-latest` / `rates:verified-history` を導入し、適格な旧KVだけを新キーへ移行
- [x] v12精度改善: API schema 12、画面/SW v12、Worker deploy停止ガード、運用runbookを更新
- [x] v12精度改善: 自動テスト全102件とTypeScript型検査に成功
- [x] v12精度改善: 初回全銀行取得失敗をfreshとしてKV固定せず、次回通常GETで再試行
- [x] v12運用安全性: 独立Cron Workerの `workers.dev` 公開を無効化し、手動refreshをtoken未設定時にfail-closed化
- [x] v12: 月替わり時の金利取得無限ループを修正（サーバ側キャッシュの当月チェック + クライアント側セッション内試行ガード）
- [x] v12: 取得失敗時に checkedMonth を進めない（翌セッションで自動再試行）
- [x] v12: 比較表の手入力ドラフトを自動取得後も保持
- [x] v12: ユーザー追加銀行と `momijiLowerRate` を保存・復元
- [x] v12: Service Workerで `/api/` をキャッシュせず、オフライン時に503 JSONを返す
- [x] v12: ボーナス月表示、全角数値、星印と借換え候補、`rowKind` 判定を修正
- [x] v11: 手入力上書きの推薦ロジックを緩和（公式確認チェック+HTTPS sourceUrlで推薦対象、applicableMonth任意化）
- [x] v11: ComparisonTableに「公式確認済みチェックで推薦対象になる」説明文を追加（モバイル/デスクトップ）
- [x] v11: rateEligibility/rateEstimation テストに 9 件追加。全 81 件パス
- [x] v11: schemaVersion 11 / Service Worker / バージョン表示を更新
- [x] v11: handoff・decision_log・test_checklistを更新

- [x] v10: 「算定不可」表示を完全廃止し、3層金利推定フォールバック（公式条件適合 / aggregator参考値 / 広告下限+団信0.3% / 業界中央レンジ）を導入する
- [x] v10: BankComparisonRow に `estimationTier` / `estimationLabel` を追加し、比較表に信頼度ラベルを表示する
- [x] v10: 推定値（第2・3・4優先）は表示するが借換え推薦の対象外とする
- [x] v10: schemaVersion 10 / Service Worker / バージョン表示を更新
- [x] v10: tests/rateEstimation.test.ts に13件のテストを追加。全72件パス
- [x] v9: モゲチェック・ZUU・Wayback Machine・前月KV履歴・Browser Renderingの5系統フォールバックを実装する
- [x] v9: UIで stale / failed 行の淡色化と当月手入力導線の強調を実装する
- [x] v9: `docs/rate-worker.md` を Cloudflare ダッシュボード手順レベルに展開する
- [x] v9: テスト追加とビルド検証、deliverables同期、handoff/decision_log/checklist更新
- [x] プロジェクト立ち上げ方針を整理する
- [x] 住宅ローン金利チェッカー v1を実装する
- [x] 成果物パッケージを作成する
- [x] テスト・ビルド・起動確認を実施する
- [x] 引き継ぎとテストチェックリストを更新する
- [x] PWAインストール対応を追加する
- [x] 銀行比較表に自動取得・公式確認・手入力補正・再判定を追加する
- [x] ホーム画面の金額を初期非表示にする
- [x] 金利変更後の比較・借換え計算を現在条件基準に修正する
- [x] 金利変更後の試算カードとService Workerキャッシュ不整合を修正する
- [x] 試算・比較・借換え画面の比較基準と説明文を抜本改修する
- [x] 公開PWAの旧キャッシュ更新と反映確認用バージョン表示を追加する
- [x] 過去日の次回返済日と借換え候補選定基準の不整合を修正する
- [x] 借換え候補を最新自動取得済み銀行の最低金利選定に変更し、金利取得ロジックを堅牢化する
- [x] 広島銀行・住信SBIの新公式URLと総合サイトフォールバックを金利取得APIに追加する
- [x] 口コミ・手数料・過去月表の誤取得を防ぎ、借換え上位候補銀行を比較表に追加する
- [x] 借換え金利取得基盤v7（共通マスタ・銀行別アダプタ・条件適合判定・Cron Worker・KV履歴）を実装する
- [x] v7の実レスポンスfixture、推薦除外、旧localStorage移行、部分失敗・KVロック回帰テストを追加する
- [x] v8で公開GETの1101、住信SBI JSONP、公式失敗時フォールバック、総合サイト誤抽出を修正する
- [x] 価格.com銀行別ページとダイヤモンド当月表を照合し、取得元・照合状態を比較画面へ表示する
- [x] v8をGitHubへPushし、Cloudflare Pagesの画面・Service Worker・GET/POST APIを公開検証する
