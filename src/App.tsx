import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import {
  buildRefinanceResultFromCurrentLoan,
  deriveComparisonRowsFromLoan,
  getLoanPaymentStalenessWarning,
  isBaseComparisonRow,
  selectBestRefinanceCandidate,
} from "./lib/comparisonMath";
import { fetchLatestRates, getCurrentMonthKey, isMonthlyAutoFetchDue } from "./lib/rateFetch";
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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function findMomijiSource(data: AppStorage): BankRateSource {
  return data.bankSources.find((source) => source.id === "momiji") ?? data.bankSources[0];
}

function getDefaultView(hasSavedData: boolean): ViewName {
  return hasSavedData ? "home" : "setup";
}

function deriveAppDataFromCurrentLoan(data: AppStorage): AppStorage {
  const comparisonRows = deriveComparisonRowsFromLoan(data.comparisonRows, data.loanProfile);
  const refinanceCandidate = selectBestRefinanceCandidate(comparisonRows);
  return {
    ...data,
    comparisonRows,
    refinanceResult: refinanceCandidate
      ? buildRefinanceResultFromCurrentLoan(
          refinanceCandidate,
          data.refinanceCostBreakdown,
          data.loanProfile,
        )
      : data.refinanceResult,
  };
}

export default function App() {
  const [initialStorage] = useState<AppStorage | null>(() => {
    const loaded = loadAppStorage();
    return loaded ? deriveAppDataFromCurrentLoan(loaded) : null;
  });
  const [isConfigured, setIsConfigured] = useState(Boolean(initialStorage));
  const [appData, setAppData] = useState<AppStorage>(
    () => initialStorage ?? deriveAppDataFromCurrentLoan(createSampleAppStorage()),
  );
  const [activeView, setActiveView] = useState<ViewName>(() =>
    getDefaultView(Boolean(initialStorage)),
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isFetchingRates, setIsFetchingRates] = useState(false);

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const updateInstalledState = () => {
      setIsInstalled(
        displayModeQuery.matches ||
          ("standalone" in navigatorWithStandalone && Boolean(navigatorWithStandalone.standalone)),
      );
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    updateInstalledState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayModeQuery.addEventListener("change", updateInstalledState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayModeQuery.removeEventListener("change", updateInstalledState);
    };
  }, []);

  const selectedScenario = useMemo(
    () =>
      appData.scenarios.find((scenario) => scenario.id === "scenario-b") ??
      appData.scenarios[0] ??
      createSampleAppStorage().scenarios[1],
    [appData.scenarios],
  );
  const paymentWarning = useMemo(
    () => getLoanPaymentStalenessWarning(appData.loanProfile),
    [appData.loanProfile],
  );

  const persist = (nextData: AppStorage, configured = true) => {
    const derivedData = deriveAppDataFromCurrentLoan(nextData);
    setAppData(derivedData);
    setIsConfigured(configured);
    if (configured) {
      saveAppStorage(derivedData);
    }
  };

  const navigate = (view: ViewName) => {
    if (!isConfigured && view !== "settings" && view !== "setup") {
      setActiveView("setup");
      return;
    }
    setActiveView(view);
  };

  const openBank = (source: BankRateSource, rowId?: string) => {
    window.open(source.rateUrl, "_blank", "noopener,noreferrer");
    const now = new Date().toISOString();
    const nextRows = rowId
      ? appData.comparisonRows.map((row) =>
          row.id === rowId ? { ...row, officialCheckedAt: now } : row,
        )
      : appData.comparisonRows;
    if (source.id === "momiji") {
      const nextData = { ...appData, comparisonRows: nextRows, lastCheckedAt: now };
      persist(nextData, isConfigured);
      return;
    }
    if (rowId) {
      persist({ ...appData, comparisonRows: nextRows }, isConfigured);
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

  const applyFetchedRates = useCallback(
    (responseRows: AppStorage["comparisonRows"], response: Awaited<ReturnType<typeof fetchLatestRates>>) => {
      const fetchedRows = responseRows.map((row): BankComparisonRow => {
        if (isBaseComparisonRow(row)) {
          return row;
        }
        const source = appData.bankSources.find((bankSource) =>
          row.bankName.includes(bankSource.bankName),
        );
        const item = response.items.find((rateItem) => rateItem.bankRateSourceId === source?.id);
        if (!item) {
          return row;
        }
        if (item.rate === null) {
          return {
            ...row,
            rateStatus: row.manualOverrideRate !== undefined ? "manual" : "failed",
            lastFetchedAt: item.fetchedAt,
            fetchError: item.message,
          };
        }
        return {
          ...row,
          autoFetchedRate: item.rate,
          rateStatus: row.manualOverrideRate !== undefined ? "manual" : "auto",
          lastFetchedAt: item.fetchedAt,
          fetchError: item.status === "needs-review" ? item.message : undefined,
        };
      });

      return deriveComparisonRowsFromLoan(fetchedRows, appData.loanProfile);
    },
    [appData.bankSources, appData.loanProfile],
  );

  const refreshRates = useCallback(
    async (force = false) => {
      if (isFetchingRates) {
        return;
      }
      const month = getCurrentMonthKey();
      if (
        !force &&
        !isMonthlyAutoFetchDue(appData.rateFetchState?.checkedMonth)
      ) {
        return;
      }

      setIsFetchingRates(true);
      const attemptAt = new Date().toISOString();
      try {
        const response = await fetchLatestRates(force);
        const comparisonRows = applyFetchedRates(appData.comparisonRows, response);
        persist(
          {
            ...appData,
            comparisonRows,
            rateFetchState: {
              checkedMonth: response.month,
              lastAttemptAt: attemptAt,
              lastSuccessfulAt: response.fetchedAt,
              source: "api",
              message: response.message,
            },
          },
          true,
        );
      } catch (error) {
        persist(
          {
            ...appData,
            rateFetchState: {
              checkedMonth: month,
              lastAttemptAt: attemptAt,
              lastSuccessfulAt: appData.rateFetchState?.lastSuccessfulAt,
              source: appData.rateFetchState?.source ?? "sample",
              message:
                error instanceof Error
                  ? `${error.message} 前回値またはサンプル値を表示しています。`
                  : "金利取得APIが失敗しました。前回値またはサンプル値を表示しています。",
            },
          },
          true,
        );
      } finally {
        setIsFetchingRates(false);
      }
    },
    [appData, applyFetchedRates, isFetchingRates],
  );

  useEffect(() => {
    if (activeView === "comparison" && isConfigured) {
      void refreshRates(false);
    }
  }, [activeView, isConfigured, refreshRates]);

  const recalculateRow = (rowId: string, manualRate: number | null) => {
    const now = new Date().toISOString();
    const comparisonRows = appData.comparisonRows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }
      return {
        ...row,
        manualOverrideRate: manualRate ?? undefined,
        lastManualUpdatedAt: manualRate !== null ? now : undefined,
        rateStatus:
          manualRate !== null
            ? "manual"
            : row.autoFetchedRate !== undefined
              ? "auto"
              : row.rateStatus ?? "sample",
      };
    });

    persist(
      {
        ...appData,
        comparisonRows,
        rateFetchState: {
          ...appData.rateFetchState,
          source: manualRate !== null ? "manual" : appData.rateFetchState?.source,
          message:
            manualRate !== null
              ? "手入力補正値を優先して概算再判定しました。"
              : "手入力補正を解除し、自動取得値またはサンプル値で概算再判定しました。",
        },
      },
      true,
    );
  };

  const installApp = async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
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
            loan={appData.loanProfile}
            paymentWarning={paymentWarning}
            rateFetchState={appData.rateFetchState}
            isFetchingRates={isFetchingRates}
            onOpenBank={openBank}
            onRefreshRates={() => void refreshRates(true)}
            onRecalculateRow={recalculateRow}
            onRefinance={() => setActiveView("refinance")}
          />
        );
      case "refinance":
        return (
          <RefinanceBenefitPage
            result={appData.refinanceResult}
            costBreakdown={appData.refinanceCostBreakdown}
            paymentWarning={paymentWarning}
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
            paymentWarning={paymentWarning}
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
    <AppShell
      activeView={activeView}
      onNavigate={navigate}
      isConfigured={isConfigured}
      canInstall={Boolean(installPrompt) && !isInstalled}
      onInstall={installApp}
    >
      {renderView()}
    </AppShell>
  );
}
