import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import {
  buildRefinanceResultFromCurrentLoan,
  deriveComparisonRowsFromLoan,
  getLoanPaymentBasisStatus,
  isBaseComparisonRow,
  selectBestRefinanceCandidate,
} from "./lib/comparisonMath";
import { fetchLatestRates, getCurrentMonthKey, isMonthlyAutoFetchDue } from "./lib/rateFetch";
import {
  createSampleAppStorage,
  ensureComparisonRowsIncludeBankSources,
  MOMIJI_LOWER_RATE,
} from "./lib/sampleData";
import { deriveScenariosFromLoan } from "./lib/scenarioMath";
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
  ManualRateVerification,
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
  const scenarios = deriveScenariosFromLoan(data.scenarios, data.loanProfile, MOMIJI_LOWER_RATE);
  const comparisonRows = deriveComparisonRowsFromLoan(
    ensureComparisonRowsIncludeBankSources(data.comparisonRows, data.bankSources),
    data.loanProfile,
  );
  const refinanceCandidate = selectBestRefinanceCandidate(
    comparisonRows,
    data.refinanceCostBreakdown,
    data.loanProfile,
  );
  return {
    ...data,
    scenarios,
    comparisonRows,
    refinanceResult: refinanceCandidate
      ? buildRefinanceResultFromCurrentLoan(
          refinanceCandidate,
          data.refinanceCostBreakdown,
          data.loanProfile,
        )
      : null,
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

  const paymentBasis = useMemo(
    () => getLoanPaymentBasisStatus(appData.loanProfile),
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
    if (source.id === "momiji") {
      const nextData = { ...appData, lastCheckedAt: now };
      persist(nextData, isConfigured);
      return;
    }
    void rowId;
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
        if (!item.offer) {
          const lastGoodOffer = item.lastGoodOffer ?? row.lastGoodRateOffer;
          return {
            ...row,
            rateOffer: lastGoodOffer ?? row.rateOffer,
            lastGoodRateOffer: lastGoodOffer,
            autoFetchedRate: lastGoodOffer?.advertisedMinRate,
            advertisedMinRate: lastGoodOffer?.advertisedMinRate,
            rateStatus:
              row.manualOverrideRate !== undefined
                ? "manual"
                : lastGoodOffer
                  ? "stale"
                  : "failed",
            lastFetchedAt: item.fetchedAt,
            fetchError: item.message,
          };
        }
        return {
          ...row,
          rateOffer: item.offer,
          lastGoodRateOffer: item.offer,
          autoFetchedRate: item.offer.advertisedMinRate,
          advertisedMinRate: item.offer.advertisedMinRate,
          rateStatus:
            row.manualOverrideRate !== undefined
              ? "manual"
              : item.offer.sourceKind === "aggregator"
                ? "reference"
                : item.status === "needs-review"
                  ? "reference"
                  : "auto",
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
        const hasFetchedRate = response.items.some((item) => Boolean(item.offer));
        const comparisonRows = applyFetchedRates(appData.comparisonRows, response);
        persist(
          {
            ...appData,
            comparisonRows,
            rateFetchState: {
              checkedMonth: response.month,
              lastAttemptAt: attemptAt,
              lastSuccessfulAt: hasFetchedRate
                ? response.fetchedAt
                : appData.rateFetchState?.lastSuccessfulAt,
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

  const recalculateRow = (rowId: string, verification: ManualRateVerification) => {
    const now = new Date().toISOString();
    const manualRate = verification.rate;
    const comparisonRows = appData.comparisonRows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }
      return {
        ...row,
        manualOverrideRate: manualRate ?? undefined,
        lastManualUpdatedAt: manualRate !== null ? now : undefined,
        manualApplicableMonth:
          manualRate !== null && verification.confirmed
            ? verification.applicableMonth
            : undefined,
        manualSourceUrl:
          manualRate !== null && verification.confirmed ? verification.sourceUrl : undefined,
        manualVerifiedAt:
          manualRate !== null && verification.confirmed ? now : undefined,
        rateStatus:
          manualRate !== null
            ? "manual"
            : row.autoFetchedRate !== undefined
              ? row.rateOffer?.sourceKind === "aggregator" || row.rateOffer?.confidence !== "verified"
                ? "reference"
                : "auto"
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
              ? verification.confirmed
                ? "公式URL・適用年月を確認済みの手入力値で概算再判定しました。"
                : "未確認の手入力補正値で概算表示しました。借換え推薦には使用しません。"
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
            paymentBasis={paymentBasis}
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
            loan={appData.loanProfile}
            paymentBasis={paymentBasis}
            onBack={() => setActiveView("comparison")}
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
            paymentBasis={paymentBasis}
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
