import { BarChart3, Calculator, Download, Home, Settings } from "lucide-react";
import type { ReactNode } from "react";
import type { ViewName } from "../types";
import { APP_BUILD_LABEL } from "../lib/version";
import { Button } from "./Button";

type AppShellProps = {
  children: ReactNode;
  activeView: ViewName;
  onNavigate: (view: ViewName) => void;
  isConfigured: boolean;
  canInstall?: boolean;
  onInstall?: () => void;
};

const navItems: Array<{ view: ViewName; label: string; icon: typeof Home }> = [
  { view: "home", label: "ホーム", icon: Home },
  { view: "scenario", label: "試算", icon: Calculator },
  { view: "comparison", label: "比較", icon: BarChart3 },
  { view: "settings", label: "設定", icon: Settings },
];

export function AppShell({
  children,
  activeView,
  onNavigate,
  isConfigured,
  canInstall = false,
  onInstall,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-screen max-w-[430px] bg-slate-50 shadow-2xl">
        <main className="min-h-screen px-4 pb-44 pt-5">
          {canInstall ? (
            <div className="mb-4 rounded-lg border border-navy-100 bg-white p-3 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-navy-700">PWA対応</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">アプリとして利用できます</p>
                </div>
                <Button className="min-h-10 px-3 py-2 text-xs" onClick={onInstall}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  インストール
                </Button>
              </div>
            </div>
          ) : null}
          {children}
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[430px] border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 backdrop-blur">
          <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-500">
            概算シミュレーションです。実際の条件は各金融機関の公式ページをご確認ください。
            <span className="mt-1 block font-bold text-navy-700">更新: {APP_BUILD_LABEL}</span>
          </p>
          <nav className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  disabled={!isConfigured && item.view !== "settings"}
                  onClick={() => onNavigate(item.view)}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-lg text-[11px] font-bold transition ${
                    active
                      ? "bg-navy-700 text-white"
                      : "text-slate-500 hover:bg-navy-50 hover:text-navy-800"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <Icon className="mb-0.5 h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </footer>
      </div>
    </div>
  );
}
