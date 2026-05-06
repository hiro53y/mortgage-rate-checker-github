import { Download, Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import {
  exportAppStorage,
  importAppStorage,
  isBankComparisonRow,
  isBankRateSource,
  isScenarioRate,
} from "../lib/storage";
import type { AppStorage, BankComparisonRow, BankRateSource, ScenarioRate } from "../types";

type SettingsPageProps = {
  data: AppStorage;
  onEditLoan: () => void;
  onReplaceBankSources: (sources: BankRateSource[]) => void;
  onReplaceScenarios: (scenarios: ScenarioRate[]) => void;
  onReplaceComparisonRows: (rows: BankComparisonRow[]) => void;
  onImportAll: (data: AppStorage) => void;
  onResetSamples: () => void;
  onClearAll: () => void;
};

const textareaClass =
  "mt-2 h-44 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100";

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage({
  data,
  onEditLoan,
  onReplaceBankSources,
  onReplaceScenarios,
  onReplaceComparisonRows,
  onImportAll,
  onResetSamples,
  onClearAll,
}: SettingsPageProps) {
  const [bankJson, setBankJson] = useState("");
  const [scenarioJson, setScenarioJson] = useState("");
  const [comparisonJson, setComparisonJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setBankJson(JSON.stringify(data.bankSources, null, 2));
    setScenarioJson(JSON.stringify(data.scenarios, null, 2));
    setComparisonJson(JSON.stringify(data.comparisonRows, null, 2));
  }, [data]);

  const saveBanks = () => {
    try {
      const parsed = JSON.parse(bankJson) as unknown;
      if (!Array.isArray(parsed) || !parsed.every(isBankRateSource)) {
        throw new Error("銀行リストの形式が正しくありません。");
      }
      onReplaceBankSources(parsed);
      setMessage("銀行リストを保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  };

  const saveScenarios = () => {
    try {
      const parsed = JSON.parse(scenarioJson) as unknown;
      if (!Array.isArray(parsed) || !parsed.every(isScenarioRate)) {
        throw new Error("シナリオの形式が正しくありません。");
      }
      onReplaceScenarios(parsed);
      setMessage("金利変更シナリオを保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  };

  const saveComparisonRows = () => {
    try {
      const parsed = JSON.parse(comparisonJson) as unknown;
      if (!Array.isArray(parsed) || !parsed.every(isBankComparisonRow)) {
        throw new Error("比較表データの形式が正しくありません。");
      }
      onReplaceComparisonRows(parsed);
      setMessage("金利データを手動更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  };

  const importAll = () => {
    try {
      const parsed = importAppStorage(importJson);
      onImportAll(parsed);
      setImportJson("");
      setMessage("JSONをインポートしました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "インポートに失敗しました。");
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">設定・データ管理</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
          設定と保存データ
        </h1>
      </header>

      {message ? (
        <Card tone="blue">
          <p className="text-sm font-semibold leading-6 text-navy-800">{message}</p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <SectionTitle title="マイローン設定" subtitle="保存済みの住宅ローン条件を編集します。" />
        <Button variant="secondary" fullWidth onClick={onEditLoan}>
          <Pencil className="h-5 w-5" aria-hidden="true" />
          マイローン設定を編集
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="銀行リストの編集" subtitle="固定URLと確認メモをJSONで編集します。" />
        <textarea
          className={textareaClass}
          value={bankJson}
          onChange={(event) => setBankJson(event.target.value)}
        />
        <Button fullWidth onClick={saveBanks}>
          銀行リストを保存
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="金利変更シナリオの追加・編集・削除" />
        <textarea
          className={textareaClass}
          value={scenarioJson}
          onChange={(event) => setScenarioJson(event.target.value)}
        />
        <Button fullWidth onClick={saveScenarios}>
          シナリオを保存
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="金利データの手動更新" subtitle="銀行比較表の表示値を編集します。" />
        <textarea
          className={textareaClass}
          value={comparisonJson}
          onChange={(event) => setComparisonJson(event.target.value)}
        />
        <Button fullWidth onClick={saveComparisonRows}>
          金利データを保存
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="JSONエクスポート / インポート" />
        <Button
          variant="secondary"
          fullWidth
          onClick={() =>
            downloadJson("mortgage-rate-checker-export.json", exportAppStorage(data))
          }
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          JSONエクスポート
        </Button>
        <textarea
          className={textareaClass}
          value={importJson}
          onChange={(event) => setImportJson(event.target.value)}
          placeholder="エクスポートしたJSONを貼り付け"
        />
        <Button fullWidth onClick={importAll}>
          <Upload className="h-5 w-5" aria-hidden="true" />
          JSONインポート
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="データ初期化" />
        <Button variant="secondary" fullWidth onClick={onResetSamples}>
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
          サンプルデータに戻す
        </Button>
        <Button variant="danger" fullWidth onClick={onClearAll}>
          <Trash2 className="h-5 w-5" aria-hidden="true" />
          全データ削除
        </Button>
      </Card>
    </div>
  );
}
