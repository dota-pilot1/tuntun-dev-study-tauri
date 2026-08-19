import { useState } from "react";
import { MonitorCog, RefreshCw, Settings2 } from "lucide-react";
import PageHeader from "../../shared/ui/PageHeader";
import { API_BASE } from "../../shared/api/client";
import { APP_PROFILE } from "../../shared/config/app-modules";

const APP_VERSION = __APP_VERSION__;

const TABS = [
  { id: "general", label: "일반 설정", icon: Settings2 },
  { id: "device", label: "장치", icon: MonitorCog },
  { id: "update", label: "업데이트", icon: RefreshCw },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** 계획서 §6 "설정" 메뉴. 1차 MVP에서 확인 가능한 항목만 노출한다. */
function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <>
      <PageHeader>
        <Settings2 className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">설정</span>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted">
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          <header>
            <h1 className="text-[18px] font-bold tracking-tight text-text-primary">앱 설정</h1>
            <p className="mt-1 text-[12px] text-text-secondary">
              연결 대상과 장치, 업데이트를 한곳에서 확인합니다.
            </p>
          </header>

          <div
            role="tablist"
            aria-label="설정 메뉴"
            className="mt-5 flex gap-1 overflow-x-auto border-b border-surface-border-soft"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[12px] font-bold transition-colors " +
                    (active ? "text-brand-primary" : "text-text-muted hover:text-text-primary")
                  }
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            {activeTab === "general" && (
              <>
                <Row label="앱 이름" value={APP_PROFILE.displayName} />
                <Row label="병원" value={APP_PROFILE.hospitalName} />
                <Row label="API 대상" value={API_BASE} mono />
                <Note>
                  API 대상은 빌드 시 <code className="font-mono">VITE_API_BASE</code> 로 결정됩니다.
                  앱 안에서 바꾸는 기능은 아직 없습니다.
                </Note>
              </>
            )}

            {activeTab === "device" && (
              <>
                <Row label="장치 모드" value="직원 콘솔 (STAFF)" />
                <Row label="비활성 초기화" value="120초" />
                <Note>
                  장치 등록과 KIOSK/STAFF 모드 전환은 계획서 5.3 단계에서 서버의 device token 발급과
                  함께 붙습니다. 지금은 직원 콘솔로만 동작합니다.
                </Note>
              </>
            )}

            {activeTab === "update" && (
              <>
                <Row label="현재 버전" value={`v${APP_VERSION}`} />
                <Note>
                  새 버전은 GitHub Release의 Tauri updater 산출물로 배포됩니다. 현재 앱에는
                  updater 기반만 연결되어 있으며, 화면에서 직접 확인·설치하는 기능은 다음 단계입니다.
                </Note>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-surface-border-soft bg-surface-raised px-4 py-3">
      <span className="text-[13px] font-bold text-text-primary">{label}</span>
      <span
        className={
          "min-w-0 truncate text-[13px] font-semibold text-text-secondary " + (mono ? "font-mono" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-surface-border-soft bg-surface-raised px-4 py-3 text-[12px] font-semibold leading-5 text-text-muted">
      {children}
    </p>
  );
}

export default SettingsPage;
