# タスク管理

## 未着手

なし

## 作業中

- [ ] 本番KV IDを設定し、独立Cron Workerをデプロイする（未設定時のライブ取得フォールバックは実装済み。手順書は `docs/rate-worker.md`）
- [ ] （任意）Workers Paid を有効化し、Worker に `BROWSER` binding を追加する（JS依存銀行向けのv9補助系統）

## 完了

- [x] v12: 月替わり時の金利取得無限ループを修正（サーバ側キャッシュの当月チェック + クライアント側セッション内試行ガード）
- [x] v12: 取得失敗時に checkedMonth を進めない（翌セッションで自動再試行できるように修正）
- [x] v12: 比較表の手入力補正が自動取得完了時に消える問題を修正（ユーザー編集値を別管理に変更）
- [x] v12: 設定画面で追加したサンプル外の銀行がリロードで消える問題を修正（validateAppStorage）
- [x] v12: もみじ銀行の新規向け下限金利を自動取得値で更新（momijiLowerRate。取得不能時は基準値0.95にフォールバック）
- [x] v12: selectBestRefinanceCandidate 等に基準日を貫通させ、日付依存で毎月壊れるテストを修正
- [x] v12: Service Worker が /api/ 失敗時に index.html を返す問題を修正（JSONエラー応答に変更、APIはキャッシュしない）
- [x] v12: ホームのボーナス月表示ハードコード（6月・12月）を実データ表示に修正
- [x] v12: 手入力値の「公式URL登録済み」文言を実態（公式ページ確認済み）に修正
- [x] v12: 数値入力の全角数字対応（NFKC正規化）
- [x] v12: 星印（優先候補）と借換え画面の候補選定を諸費用込み選定で統一
- [x] v12: isBaseComparisonRow は rowKind を優先判定に変更
- [x] v12: git追跡されていた node_modules シンボリックリンクを追跡解除
- [x] v12: テスト3件追加（ユーザー追加銀行の保持、momijiLowerRate復元）。全83件パス
- [x] v12: Service Worker / バージョン表示を v12-20260704 に更新

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
