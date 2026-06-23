# 引き継ぎメモ

## 2026-06-24 v8 取得不能修正

## 現在の状況

公開Pages APIのGETがCloudflare 1101になり、画面上で銀行データを取得できない状態を再現した。原因は、GETのキャッシュ未命中経路がコメントアウト済みv6内の `getMonthKey` を参照していたこと、KV/Cronが未設定の公開環境でキャッシュ専用設計になっていたこと、住信SBIの実JSONPにある連続カンマをJSONとして解析できなかったこと、公式アダプタ失敗時に総合サイトへ継続しないことの複合だった。

修正後の2026年06月24日実ページ診断では13銀行すべてに当月値が入り、公式構造化データ3銀行、複数情報源一致8銀行、単一情報源・要確認2銀行となった。要確認は楽天銀行と広島銀行で、値は表示するが自動推薦対象外である。

## 変更内容

- Pages GETはKVが未設定または空でもライブ取得し、失敗時は1101ではなくJSON 502を返すよう修正
- 住信SBI公式JSONPの欠損配列、末尾カンマ、`undefined`、`NaN`を正規化
- 公式構造化アダプタ失敗後も、価格.comとダイヤモンド不動産の照合へ継続
- 価格.comの借換えランキングカードと銀行別借換え変動商品の構造パーサを追加
- ダイヤモンド不動産の銀行別当月行パーサを13銀行分へ拡張し、過去月、固定金利、手数料を除外
- 公式、価格.com、ダイヤモンド不動産の証跡を `RateOffer.evidence` に保持し、複数情報源一致を `corroborated` として区別
- 公式HTML診断を並列化し、4xxの不要な再試行を停止。通常タイムアウト8秒、公式HTML診断6秒に短縮
- 比較画面に照合状態と照合元を表示
- 画面ビルド表示を `2026/06/24 v8`、Service Workerを `mortgage-rate-checker-v8-20260624` に更新

## 検証

- ルート: `npm test` 成功（52件）
- ルート: `npx tsc -b` 成功
- ルート: Functions/Workerの `node --check` 成功
- 2026年06月24日ローカル実ページ: 13/13銀行で金利値取得、公式3、複数照合8、単一参考2
- Cloudflare Pages公開GET/POST: HTTP 200、schema 8、13/13銀行で値取得、公式3、複数照合5、単一参考5
- GitHub `main` とCloudflare Pages公開版へv8反映済み（アプリ修正 `5e1bb50`、再実行 `6f028b7`、UTC compatibility date修正 `49290a5`）
- 公開バンドルの `2026/06/24 v8` とService Worker `mortgage-rate-checker-v8-20260624` を確認
- ローカル `npm run build` とWrangler dry-runはコードエラーではなく、この実行環境の全子プロセス起動に対する `spawn EPERM` で未完了

## 未完了

- 本番KV ID設定と独立Cron Workerデプロイ。未設定でもライブ取得は動作するが、初回表示が外部サイト応答時間に依存する

## 次にやること

- 安定した定期キャッシュ運用には本番KVとCron Workerを設定する

## 2026-06-21 v7 追加対応

## 現在の状況

汎用正規表現で13銀行のページから最小値を探す方式を廃止し、公式構造化データを優先する銀行別アダプタ方式へ移行した。住信SBIネット銀行、PayPay銀行、SBI新生銀行は実APIレスポンス構造に基づくfixtureで検証済み。広島銀行と価格.comは参考値として表示するが推薦対象外にした。

## 変更内容

- フロントとFunctionsで共用する銀行マスタを `shared/bankRateSources.js` に集約
- `RateOffer` に広告下限、条件適合、基準・割引・団信・長期上乗せ、適用年月、取得元、信頼度、適格状態、失敗理由を追加
- 住信SBI JSONP、PayPay POST JSON、SBI新生JSONの公式アダプタを追加
- 価格.comのShift_JIS復号、広島銀行のダイヤモンド不動産最新月表パーサを追加。どちらも推薦対象外
- 生年月日、概算物件価値、団信選択を追加し、融資率、年齢、残期間、団信上乗せから条件適合金利を算定
- 当月・公式・条件適合、または公式URL/確認日/適用年月付き手入力だけを借換え推薦対象に変更
- 前月値は表示用の最後の正常値として保持し、推薦対象から除外
- 独立Cloudflare Worker、毎日06:00 JST Cron、銀行別タイムアウト/再試行、`Promise.allSettled`、KV履歴、10分ロックを追加
- 比較画面に条件適合金利、広告下限、適用年月、取得元、適合状態、対象外理由を表示
- 画面下部を `更新: 2026/06/21 v7`、Service Workerを `mortgage-rate-checker-v7-20260621` に更新

## 検証

- ルート: `npm test` 成功（47件、うちv7追加16件）
- ルート: `npx tsc -b` 成功
- ルート: `node --check`（rates、adapters、service、worker）成功
- Wrangler 4.103.0: `npm run worker:types` 成功
- Wrangler 4.103.0: `npm run worker:check` 成功
- 公式実レスポンス確認: 住信SBI JSONP、PayPay API、SBI新生APIがHTTP 200
- `deliverables/mortgage-rate-checker-github/`: `npm test`、`npx tsc -b`、各 `node --check` 成功
- GitHub `main` へ v7 をCommit/Push済み（`1ecfe1c`）
- Cloudflare Pages公開URLでJSの `2026/06/21 v7` とService Workerの `mortgage-rate-checker-v7-20260621` を確認

## 未完了

- `npm run build` はこの実行環境でVite/esbuildの子プロセス起動が `spawn EPERM` となり未完了。ルートの既存 `dist` 削除もOneDriveの `EPERM` になる
- ローカルVite画面確認は同じ子プロセス起動制限により未実施
- `worker/wrangler.jsonc` のKV IDはプレースホルダー。本番namespace IDへの置換とPages Dashboardへの同namespaceバインドが必要
- 独立Cron Workerのデプロイは未実施
- 公式構造化アダプタがない銀行は、現段階では公式HTML診断値または価格.com参考値であり推薦対象外

## 次にやること

- [金利取得Worker手順](rate-worker.md)に従いKV namespaceを作成し、Worker設定のID置換とPages Dashboardバインドを行う
- ローカル端末でルートと成果物の `npm run build` を実行する
- 独立Cron Workerをデプロイする
- 公開画面で取得元、適用年月、条件適合金利を公式表示と照合する

## 2026-06-13 v6 追加対応

## 現在の状況

実機画面で、住信SBIネット銀行が 0.400%、広島銀行が 2.200% と表示されていた。確認したところ、住信SBIは口コミ欄の過去年利、広島銀行は手数料・固定金利列・過去月表など、現在の借換え変動適用金利ではない数値を拾う余地があった。今回、誤取得を防ぐフィルタと、借換え上位候補銀行の母集団補完を追加した。

## 変更内容

- 口コミ・評判・借入時期・金利種別の近傍にある数値を金利候補から除外
- 事務手数料、保証料、団信上乗せ率、固定金利列を金利候補から除外
- 広島銀行・住信SBIネット銀行・PayPay銀行・SBI新生銀行・auじぶん銀行・主要ネット銀行に、銀行別の想定金利レンジを設定
- 広島銀行のダイヤモンド不動産研究所ページでは、月別表の最新月の変動金利列を優先して抽出
- PayPay銀行・SBI新生銀行・auじぶん銀行を、既存localStorageに行がない場合でも比較表へ自動補完
- PayPay銀行・SBI新生銀行・auじぶん銀行にもモゲチェック/価格.comの借換えランキングを補助取得先として追加
- 画面下部のビルド表示を `更新: 2026/06/13 v6`、Service Workerキャッシュ名を `mortgage-rate-checker-v6-20260613` に更新

## 検証

- ルート: `npm test` 成功
- ルート: `node --check functions/api/rates.js` 成功
- ルート: `npx tsc -b` 成功
- ルート: `npm run build` 成功（通常実行は `dist` 削除で `EPERM`、権限付き再実行で成功）
- `deliverables/mortgage-rate-checker-github/`: `npm test` 成功
- `deliverables/mortgage-rate-checker-github/`: `node --check functions/api/rates.js` 成功
- `deliverables/mortgage-rate-checker-github/`: `npx tsc -b` 成功
- `deliverables/mortgage-rate-checker-github/`: `npm run build` 成功（通常実行は `dist` 削除で `EPERM`、権限付き再実行で成功）

## 未完了

- GitHub commit/push と Cloudflare Pages再デプロイは未実施
- 総合サイト由来の値は公式確認が必要。自動抽出できても正確性は未保証

## 次にやること

- `deliverables/mortgage-rate-checker-github/` の変更をCommit/Pushする
- Cloudflare Pagesデプロイ後、画面下部が `更新: 2026/06/13 v6` になることを確認する
- 比較画面で「再取得」を押し、住信SBI 0.400% や広島銀行 2.200% が採用されないことを確認する

## 2026-06-13 v5 追加対応

## 現在の状況

ユーザーから、広島銀行と住信SBIネット銀行の参照先URL、および公式ページで金利判断できない場合に参照する総合サイトの指定があった。今回、公式URLの優先候補を差し替え、公式ページで取得できない場合に総合サイトを銀行名別に探索するフォールバックを追加した。

## 変更内容

- 住信SBIネット銀行の公式取得URLに `https://www.netbk.co.jp/contents/lp/homeloan/web/re.html` を追加し、優先順位を先頭にした
- 広島銀行の公式取得URLに `https://www.hirogin.co.jp/service/loan/housing-loan/super/` を追加し、優先順位を先頭にした
- 画面の公式ページボタン用マスタ `bankSources` も同じURLへ更新
- 公式ページと公式ページ内リンクで金利を特定できない場合、モゲチェック・価格.com・ダイヤモンド不動産研究所を総合サイトフォールバックとして確認するように変更
- 総合サイトでは銀行名・別名を含むブロックだけを対象にし、実質金利より表面金利・適用金利・変動金利を優先して抽出
- 住信SBIネット銀行・広島銀行のサンプル表示金利を 0.950% に更新。ただしサンプル値だけでは借換え候補にしない仕様は維持
- APIレスポンス型に `attemptedUrls` を追加
- 画面下部のビルド表示を `更新: 2026/06/13 v5`、Service Workerキャッシュ名を `mortgage-rate-checker-v5-20260613` に更新
- `deliverables/mortgage-rate-checker-github/` へ同期済み

## 検証

- ルート: `npm test` 成功
- ルート: `node --check functions/api/rates.js` 成功
- ルート: `npx tsc -b` 成功
- ルート: `npm run build` 成功（通常実行は `dist` 削除で `EPERM`、権限付き再実行で成功）
- `deliverables/mortgage-rate-checker-github/`: `npm test` 成功
- `deliverables/mortgage-rate-checker-github/`: `node --check functions/api/rates.js` 成功
- `deliverables/mortgage-rate-checker-github/`: `npx tsc -b` 成功
- `deliverables/mortgage-rate-checker-github/`: `npm run build` 成功（通常実行は `dist` 削除で `EPERM`、権限付き再実行で成功）

## 未完了

- GitHub commit/push と Cloudflare Pages再デプロイは未実施
- ローカルVite画面確認はv5では未実施
- 総合サイト由来の値は公式確認が必要。自動抽出できても正確性は未保証

## 次にやること

- GitHub Desktopで `deliverables/mortgage-rate-checker-github/` の変更をCommit/Pushする
- Cloudflare Pagesデプロイ後、画面下部が `更新: 2026/06/13 v5` になることを確認する
- 比較画面で「再取得」を押し、住信SBI/広島銀行が新URLまたは総合サイトフォールバックで取得できるか確認する

## 2026-06-13 v4 追加対応

## 現在の状況

公開画面で、最新金利を自動取得できなかった住信SBIネット銀行が借換え候補として選ばれていた。原因は、候補選定がサンプル値・手入力値・過去値を含む行から選ばれる余地があり、取得失敗行でも低い `effectiveRate` が残っていたため。今回、借換え候補は「最新金利を自動取得できた銀行」だけから、判定使用金利が最も低い銀行を選ぶ仕様に変更した。

住信SBIネット銀行の公式ページは、確認時点で金利表示ページの静的HTMLに `年--%` のような動的表示プレースホルダーが含まれており、Cloudflare Pages Functionsの単純なHTML取得だけでは金利値を取得できない可能性がある。この場合は推測値を入れず、取得失敗として候補から除外する。

## 変更内容

- `selectBestRefinanceCandidate` を、非基準行かつ `autoFetchedRate` と `lastFetchedAt` を持ち、`rateStatus !== "failed"` の行だけから選ぶように変更
- 借換え候補の優先順位を「実質メリット最大」から「最新自動取得済み銀行のうち判定使用金利が最低」へ変更
- 金利取得失敗時に古い `autoFetchedRate` を消し、取得失敗行が借換え候補に残らないように変更
- 最新取得済み候補がない場合、借換え画面に「最新取得済みの候補がありません」と表示
- サンプルデータの住信SBI固定候補フラグと「有力候補」注記を削除
- `/api/rates` を複数URL取得、公式ページ内リンク探索、タイムアウト、ブラウザ相当ヘッダー、文脈スコアリング方式へ変更
- 金利抽出で `年--%` のプレースホルダーや団信上乗せ率だけを取得成功扱いしないテストを追加
- 画面下部のビルド表示を `更新: 2026/06/13 v4` に更新し、Service Workerキャッシュ名を `mortgage-rate-checker-v4-20260613` に更新
- `deliverables/mortgage-rate-checker-github/` へ今回の修正ファイルを同期済み

## 検証

- ルート: `npm test` 成功
- ルート: `node --check functions/api/rates.js` 成功
- ルート: `npx tsc -b` 成功
- `deliverables/mortgage-rate-checker-github/`: `npm test` 成功
- `deliverables/mortgage-rate-checker-github/`: `npx tsc -b` 成功
- 旧文言・旧バージョン残存チェック: ソース/Functions/テスト/公開対象フォルダで `v4` と候補なし文言を確認

## 未完了

- ルート/配信用フォルダの `npm run build` は、OneDrive配下の `dist` 削除で `EPERM`。権限付き再実行は利用制限で不可だった
- ローカルVite画面確認は、Vite/esbuild起動が `EPERM` のためv4では未実施
- GitHub commit/push と Cloudflare Pages再デプロイは未実施
- 各銀行の本日金利の正確性は未検証。自動取得値は公式確認と手入力補正が前提

## 次にやること

- GitHub Desktopで `deliverables/mortgage-rate-checker-github/` の変更をCommit/Pushする
- Cloudflare Pagesの最新デプロイ後、画面下部に `更新: 2026/06/13 v4` が表示されることを確認する
- 比較画面で取得失敗の住信SBIに星が付かず、借換え画面で未取得銀行が候補にならないことを確認する

## 2026-06-13

## 現在の状況

実機スクリーンショットで、現在金利 1.005% がもみじ銀行下限 0.950% より高いにもかかわらず「交渉優先度は低め」と表示される旧画面を確認。公開URL `https://mortgage-rate-checker-github.pages.dev/` のJSは新文言を配信済みだったため、主因はスマホPWA側の旧Service Worker/キャッシュ残存と判断。旧画面を判別できる版番号表示と、Service Worker更新強化を追加済み。

## 変更内容

- 試算画面から「交渉優先度は低め」という表現を廃止し、「現在金利は下限金利より高い/低い/同水準」と事実ベースの見出しに変更
- 試算画面に `現在金利 - 下限金利` の判定式を表示
- 試算画面を「現在金利の判定」と「将来シナリオ別試算」に分離
- シナリオカードで「シナリオ金利」を明示し、警告判定は保存済みフラグではなく金利差から都度算出
- 比較表の基準カードに、比較元・現在適用金利・月返済・ボーナス返済・残期間・表の差額期間を表示
- 比較表にボーナス返済列を追加し、差額列を「12年累計差（月返済分）」へ改名
- 借換え候補の総返済額を、月返済だけでなくボーナス返済も候補金利で再計算するように変更
- 借換え画面に、比較元/候補、月返済差、ボーナス返済差、平均月換算差、残り総返済額差、諸費用差引後の計算式を表示
- 実質的に候補固定保存していなかった「この候補を保存」ボタンを削除
- 比較表の基準行を `rowKind` で明示するように変更
- 画面下部に `更新: 2026/06/13 v3` を表示し、旧画面か新画面かを実機で判別できるように変更
- Service Workerのキャッシュ名を `mortgage-rate-checker-v3-20260613` に更新し、更新検知時に `SKIP_WAITING` とリロードで新バンドルへ切り替えるように変更
- `/assets/` もnetwork-firstにし、旧JS/CSSが残りにくい挙動へ変更
- ビルド前に `dist` とViteキャッシュを削除する `scripts/clean-dist.mjs` を追加
- 初回設定フォーム下部の余白を増やし、固定フッターで保存ボタンが押しにくくならないように変更
- 返済額が旧通知額のままの場合、金利比較・借換えでは現在金利から逆算した比較用返済額を使うように変更
- 次回返済日が過去日の場合、保存値は上書きせず、同じ返済日で未来月へ繰り上げた日付を試算用の次回返済日として使うように変更
- 借換え候補の自動選択を、12年の月返済差ではなく、残期間全体・ボーナス返済・諸費用込みの概算メリット最大に変更
- スマホの比較表をカード表示にし、差額ラベルを「12年月返済差」として総返済メリットと区別
- ホームで金額非表示の場合、返済額確認カード内の登録額・比較用概算額も `*****` 表示に変更

## 検証

- サブエージェント2体でコードレビューを実施
- ルート: `npm test` 成功
- ルート: `npx tsc -b` 成功
- ルート: `npm run build` 成功（OneDrive配下の `dist` 削除は権限付き実行が必要）
- `deliverables/mortgage-rate-checker-github/`: `npm test` 成功
- `deliverables/mortgage-rate-checker-github/`: `npx tsc -b` 成功
- `deliverables/mortgage-rate-checker-github/`: `npm run build` 成功
- ローカルVite画面確認:
  - 初回設定で 1.005% を保存できることを確認
  - ホームに 1.005% / 下限 0.950% / 差 +0.055% と返済額未更新警告が表示されることを確認
  - ホームの金額非表示時に返済額確認カード内の金額もマスクされることを確認
  - 試算画面の見出しが「現在金利は下限金利より高いです」になり、旧文言「交渉優先度は低め」が出ないことを確認
  - 試算画面で下限金利シナリオが毎月 90,128円、ボーナス 113,045円、金利比較差 約-13,664円になることを確認
  - 比較画面で試算用の次回返済日が 2026-06-27、比較用月返済が 91,068円、比較用ボーナス返済が 114,237円になることを確認
  - スマホ幅の比較表で「12年月返済差」カード表示になり、住信SBIネット銀行が +28.2万円になることを確認
  - 借換え画面に「比較しているもの」と諸費用差引後の計算式が表示されることを確認
  - 借換え画面で住信SBIネット銀行 0.890%、毎月 1,959円安い、ボーナス 2,484円安い、諸費用差引後 +329,360円になることを確認
- 公開URL確認:
  - `https://mortgage-rate-checker-github.pages.dev/` がHTTP 200を返すことを確認
  - 既存公開JSに新文言が含まれ、旧文言が含まれないことを確認
  - 既存公開 `sw.js` は更新前時点で `mortgage-rate-checker-v2-20260612` だったため、今回v3へ更新

## 未完了

- 各銀行の本日金利の正確性は未検証。自動取得値・サンプル値は公式確認と手入力補正が前提
- Cloudflare Pagesのデプロイ完了確認は、GitHub push後に公開URLの `sw.js` が `v3` になるかで確認する
- 実機で旧画面が残る場合は、PWAを一度閉じて再起動、またはブラウザで公開URLを再読み込みする
- 返済額・残高・次回返済日は銀行通知の最新値を手入力する前提。過去日の次回返済日は試算用に繰り上げるが、実通知額の正確性はユーザー入力に依存する

## 次にやること

- `deliverables/mortgage-rate-checker-github/` の変更をCommit/Pushする
- Cloudflare Pagesの最新デプロイ後、スマホ画面下部に `更新: 2026/06/13 v3` が表示されることを確認する
- 試算画面の見出しが「現在金利は下限金利より高いです」になることを確認する

## 2026-06-12

## 現在の状況

金利を 1.005% に変更済みの保存データで、試算カードが旧サンプル値を表示し続ける不整合を修正済み。あわせて、デプロイ後に古い画面が残る原因になっていたService Workerのcache-first挙動を修正済み。

## 変更内容

- 試算シナリオの毎月返済額・ボーナス返済額・年間差額を、現在条件の残高・残期間・手入力返済額から再計算するようにした
- 現在金利と同じシナリオは、銀行通知額として登録された毎月返済額・ボーナス返済額を正とし、年間差額を0円にするようにした
- 試算カードの表示を「年間増加」から「年間差額」に変更し、下限金利シナリオではマイナス差額を表示するようにした
- 試算カードの判定文言を、現在金利との関係に応じて「現在条件は交渉検討水準」「現在条件より低い」などに分岐するようにした
- Service Workerのキャッシュ名を更新し、HTMLはnetwork-first、assetsはcache-firstに変更した
- 開発環境ではService Workerを登録せず、既存登録と関連キャッシュを削除するようにした
- `src/vite-env.d.ts` を追加し、`import.meta.env.PROD` の型を解決した

## 検証

- ルート: `npm test` 成功
- ルート: `npm run build` 成功
- ローカルVite画面確認:
  - 現在金利 1.005%、もみじ銀行下限金利 0.950% で、試算見出しが「金利引き下げ交渉を検討してください」になることを確認
  - シナリオA 0.950% が毎月 89,975円、ボーナス 113,045円、年間差額 約-13,676円として表示されることを確認
  - シナリオB 1.005% が現在条件と同水準、年間差額 約0円として表示されることを確認
  - 比較表が現在条件 1.005% / 月返済 90,916円を基準に再計算されることを確認
  - 借換え画面で住信SBIネット銀行 / 使用金利 0.890% / 比較基準 90,916円が表示されることを確認

## 未完了

- 各銀行の本日金利の正確性は未検証。画面上の自動取得値・サンプル値は公式確認と手入力補正が前提
- GitHub Desktop用フォルダには同期予定。反映にはGitHub DesktopでのCommit/PushとCloudflare Pages再デプロイが必要

## 次にやること

- GitHub Desktopで変更ファイルを確認し、Commit to main → Push origin を実行する
- Cloudflare Pagesでデプロイ完了後、ブラウザまたはスマホで一度再読み込みする。旧Service Worker利用者は初回アクセス後の再読み込みで新HTMLに切り替わる可能性がある

## 2026-06-07

## 現在の状況

金利を 0.755% から 1.005% に変更した後、ホーム以外の試算・比較・借換え画面に旧サンプル前提が残る不整合を修正済み。

## 変更内容

- 比較表と借換えメリットの基準を「選択中シナリオ」から「現在条件」に変更
- 現在条件保存、金利取得、手入力補正、JSONインポート後に比較表・借換え結果を再派生するようにした
- 金利だけ変更され、毎月返済額・ボーナス返済額が未更新に見える場合は警告を表示するようにした
- 借換え候補は比較表の非基準行から実質メリット最大の行を自動選択し、候補銀行名・使用金利・基準月返済額を表示するようにした
- 試算画面の見出しと説明文を、現在金利がもみじ銀行下限金利より高い・同水準・低い場合で分岐するようにした
- 旧localStorageデータ読み込み時も、派生値を現在条件から再計算するようにした
- 既存成果物を上書きせず、修正版パッケージを `deliverables/mortgage-rate-checker-current-basis-20260607/` に作成済み

## 検証

- ルート: `npm test` 成功
- ルート: `npm run build` 成功
- 成果物フォルダ: `npm install`、`npm test`、`npm run build` 成功
- ローカルVite画面確認:
  - 旧保存データで 1.005% / 月返済 86,689円の場合、ホーム・比較・借換えに返済額未更新警告が表示されることを確認
  - 試算画面が「金利引き下げ交渉を検討してください」に変わることを確認
  - 月返済 90,916円、ボーナス返済 114,237円へ手入力更新後、比較表が現在条件基準で再計算され、借換え候補が住信SBIネット銀行に自動選択されることを確認

## 未完了

- 各銀行の本日金利の正確性は未検証。自動取得値とサンプル値は公式確認・手入力補正前提
- Cloudflare Pagesへの再デプロイは未実施

## 次にやること

- Cloudflare Pagesへ `npm run build` / `dist` を指定して再デプロイする
- 実際の銀行通知額が確定したら、マイローン設定で毎月返済額・ボーナス返済額を手入力する

## 2026-05-06

## 現在の状況

住宅ローン金利チェッカー v1をReact + Vite + TypeScript + Tailwind CSSで実装済み。

## 変更内容

- 初回設定、ホーム、金利変更シナリオ、銀行比較表、借換えメリット、設定・データ管理の6画面を実装
- localStorage保存、JSONエクスポート/インポート、サンプル復元、全データ削除を実装
- 13銀行の固定URLデータ、シナリオA/B、比較表サンプル、借換え試算サンプルを登録
- 元利均等返済、シナリオ差分、借換え判定の計算関数とテストを追加
- `deliverables/mortgage-rate-checker/` に自己完結パッケージを作成
- GitHubアップロード用に `deliverables/mortgage-rate-checker-github/` を作成し、`node_modules/` と `dist/` を含めない構成にした
- PWAインストール対応としてManifest、Service Worker、192px/512px PNGアイコン、アプリ内インストールボタンを追加
- 銀行比較表に自動取得値、公式確認ボタン、手入力補正、再判定ボタンを追加
- Cloudflare Pages Functions `/api/rates` を追加し、毎月10日以降の月次金利候補取得に対応
- 再判定時に月返済、実質メリット、借換えメリットを手入力補正優先で再計算するようにした
- ホーム画面の現在残高、毎月返済額、ボーナス返済額、当初お借入金額、次回返済予定額を初期状態で `*****` にマスクし、ボタンで表示/非表示を切り替えるようにした

## 検証

- ルート: `npm test` 成功
- ルート: `npm run build` 成功
- `dist/` をNode一時HTTPサーバーで配信し、HTTP 200とタイトル文字列を確認
- 成果物フォルダ: `npm install`、`npm test`、`npm run build` 成功
- PWA追加後のルート: `npm test` 成功、`npm run build` 成功
- 自動取得/手入力補正改修後のルート: `npm test` 成功、`npm run build` 成功
- ホーム画面金額マスク改修後のルート: `npm test` 成功、`npm run build` 成功

## 未完了

- Codex実行ポリシーにより、Vite dev serverのバックグラウンド常駐起動はブロックされた
- 添付画像は指定パスで読めなかったため、プロンプト本文のUI指定を優先した
- Cloudflare KV `RATE_CACHE` は任意。未設定でもAPIは動くが、当月取得結果のサーバー側共有キャッシュは効かない

## 次にやること

- ブラウザで `npm run dev` を起動し、スマホ幅で最終目視確認する
- Cloudflare Pagesで `npm run build` / `dist` を指定して公開する
