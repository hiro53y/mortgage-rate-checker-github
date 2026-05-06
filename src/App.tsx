import { useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { createSampleAppStorage } from "./lib/sampleData";
import {
  clearAppStorage,
  loadAppStorage,
  saveAppStorage,
} from "./lib/storage";
import { BankComparisonPage } from "./pages/BankComparisonPage";
import { HomePage } from "./pages/HomePage";
import { RefinanceBenefitPage } from "./pages/RefinanceBenefitPage";
import { ScenarioPage } from "./pages/ScenarioPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import type {
  AppStorage,
  BankComparisonRow,
  BankRateSource,
  LoanProfile,
  ScenarioRate,
  ViewName,
} from "./types";

function findMomijiSource(data: AppStorage): BankRateSource {
  return data.bankSources.find((source) => source.id === "momiji") ?? data.bankSources[0];
}

function getDefaultView(hasSavedData: boolean): ViewName {
  return hasSavedData ? "home" : "setup";
}

export default function App() {
  const [initialStorage] = useState<AppStorage | null>(() => loadAppStorage());
  const [isConfigured, setIsConfigured] = useState(Boolean(initialStorage));
  const [appData, setAppData] = useState<AppStorage>(
    () => initialStorage ?? createSampleAppStorage(),
  );
  const [activeView, setActiveView] = useState<ViewName>(() =>
    getDefaultView(Boolean(initialStorage)),
  );

  const selectedScenario = useMemo(
    () =>
      appData.scenarios.find((scenario) => scenario.id === "scenario-b") ??
      appData.scenarios[0] ??
      createSampleAppStorage().scenarios[1],
    [appData.scenarios],
  );

  const persist = (nextData: AppStorage, configured = true) => {
    setAppData(nextData);
    setIsConfigured(configured);
    if (configured) {
      saveAppStorage(nextData);
    }
  };

  const navigate = (view: ViewName) => {
    if (!isConfigured && view !== "settings" && view !== "setup") {
      setActiveView("setup");
      return;
    }
    setActiveView(view);
  };

  const openBank = (source: BankRateSource) => {
    window.open(source.rateUrl, "_blank", "noopener,noreferrer");
    if (source.id === "momiji") {
      const nextData = { ...appData, lastCheckedAt: new Date().toISOString() };
      persist(nextData, isConfigured);
    }
  };

  const saveLoanProfile = (loanProfile: LoanProfile) => {
    const nextData = { ...appData, loanProfile };
    persist(nextData, true);
    setActiveView("home");
  };

  const replaceBankSources = (bankSources: BankRateSource[]) => {
    persist({ ...appData, bankSources }, true);
  };

  const replaceScenarios = (scenarios: ScenarioRate[]) => {
    persist({ ...appData, scenarios }, true);
  };

  const replaceComparisonRows = (comparisonRows: BankComparisonRow[]) => {
    persist({ ...appData, comparisonRows }, true);
  };

  const importAll = (data: AppStorage) => {
    persist(data, true);
    setActiveView("settings");
  };

  const resetSamples = () => {
    const sample = createSampleAppStorage();
    persist(sample, true);
    setActiveView("settings");
  };

  const clearAll = () => {
    const confirmed = window.confirm("保存データをすべて削除します。よろしいですか。");
    if (!confirmed) {
      return;
    }
    clearAppStorage();
    setAppData(createSampleAppStorage());
    setIsConfigured(false);
    setActiveView("setup");
  };

  const saveRefinanceCandidate = () => {
    window.alert("この候補を保存しました。v1では現在の端末内データとして保持します。");
    persist({ ...appData }, true);
  };

  const renderView = () => {
    if (!isConfigured && activeView !== "settings") {
      return (
        <SetupPage
          loan={appData.loanProfile}
          isInitial
          onSave={saveLoanProfile}
        />
      );
    }

    switch (activeView) {
      case "setup":
        return (
          <SetupPage
            loan={appData.loanProfile}
            isInitial={!isConfigured}
            onSave={saveLoanProfile}
          />
        );
      case "scenario":
        return (
          <ScenarioPage
            loan={appData.loanProfile}
            scenarios={appData.scenarios}
            onComparison={() => setActiveView("comparison")}
            onOpenOfficial={() => openBank(findMomijiSource(appData))}
          />
        );
      case "comparison":
        return (
          <BankComparisonPage
            rows={appData.comparisonRows}
            sources={appData.bankSources}
            selectedScenario={selectedScenario}
            onOpenBank={openBank}
            onRefinance={() => setActiveView("refinance")}
          />
        );
      case "refinance":
        return (
          <RefinanceBenefitPage
            result={appData.refinanceResult}
            costBreakdown={appData.refinanceCostBreakdown}
            selectedScenario={selectedScenario}
            onBack={() => setActiveView("comparison")}
            onSaveCandidate={saveRefinanceCandidate}
          />
        );
      case "settings":
        return (
          <SettingsPage
            data={appData}
            onEditLoan={() => setActiveView("setup")}
            onReplaceBankSources={replaceBankSources}
            onReplaceScenarios={replaceScenarios}
            onReplaceComparisonRows={replaceComparisonRows}
            onImportAll={importAll}
            onResetSamples={resetSamples}
            onClearAll={clearAll}
          />
        );
      case "home":
      default:
        return (
          <HomePage
            loan={appData.loanProfile}
            lastCheckedAt={appData.lastCheckedAt}
            onCheckLatest={() => openBank(findMomijiSource(appData))}
            onScenario={() => setActiveView("scenario")}
            onComparison={() => setActiveView("comparison")}
            onEdit={() => setActiveView("setup")}
          />
        );
    }
  };

  return (
    <AppShell activeView={activeView} onNavigate={navigate} isConfigured={isConfigured}>
      {renderView()}
    </AppShell>
  );
}
