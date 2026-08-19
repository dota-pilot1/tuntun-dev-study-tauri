import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Database, MonitorCog, RefreshCw, Settings2 } from "lucide-react";
import PageHeader from "../../shared/ui/PageHeader";
import { API_BASE, getApiTarget, type ApiTarget } from "../../shared/api/client";
import { APP_PROFILE } from "../../shared/config/app-modules";

const APP_VERSION = __APP_VERSION__;

const TABS = [
  { id: "general", label: "일반 설정", icon: Settings2 },
  { id: "device", label: "장치", icon: MonitorCog },
  { id: "update", label: "업데이트", icon: RefreshCw },
  { id: "database", label: "DB 동기화", icon: Database },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** 계획서 §6 "설정" 메뉴. 1차 MVP에서 확인 가능한 항목만 노출한다. */
function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const apiTarget = getApiTarget();

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

            {activeTab === "database" && <DatabaseSyncPanel apiTarget={apiTarget} />}
          </div>
        </div>
      </div>
    </>
  );
}

function DatabaseSyncPanel({ apiTarget }: { apiTarget: ApiTarget }) {
  const localMode = apiTarget === "local";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = localMode ? "운영 DB를 로컬로 가져오기" : "로컬 DB를 운영으로 반영하기";
  const description = localMode
    ? "운영 데이터를 로컬 개발 DB로 복사합니다. 로컬 DB의 기존 데이터는 백업 후 교체됩니다."
    : "로컬 개발 DB를 운영 DB에 반영합니다. 운영 DB를 덮어쓰기 전에 자동 백업을 생성합니다.";

  const runSync = async () => {
    if (!localMode && !window.confirm("로컬 DB로 운영 DB를 덮어쓰고 백업을 생성하시겠습니까?")) {
      return;
    }
    if (localMode && !window.confirm("운영 DB 데이터를 로컬 DB로 복사하시겠습니까?")) return;
    setBusy(true);
    setMessage("동기화를 시작했습니다. DB 크기에 따라 시간이 걸릴 수 있습니다.");
    setError(null);
    try {
      const output = await invoke<string>("db_sync", { direction: localMode ? "pull" : "push" });
      setMessage(output || "동기화가 완료되었습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-md border border-surface-border-soft bg-surface-raised px-4 py-4">
        <div className="flex items-start gap-3">
          {localMode ? (
            <ArrowDownToLine className="mt-0.5 size-5 shrink-0 text-brand-primary" />
          ) : (
            <ArrowUpFromLine className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="text-[14px] font-black text-text-primary">{title}</p>
            <p className="mt-1 text-[12px] font-semibold leading-5 text-text-secondary">{description}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-surface-muted px-3 py-2 text-[12px] font-bold">
          <span className="text-text-muted">현재 연결 대상</span>
          <span className="text-text-primary">{localMode ? "로컬" : "배포"}</span>
        </div>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-[12px] font-semibold leading-5 text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {localMode
              ? "운영 DB의 개인정보는 로컬에 복사하기 전에 마스킹 정책을 확인하세요."
              : "운영 반영은 운영 DB를 덮어씁니다. 백업 성공과 대상 확인 없이는 실행되지 않습니다."}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void runSync()}
        className="ui-icon-button-brand h-10 w-full gap-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {localMode ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}
        {busy ? "동기화 중..." : "동기화 실행"}
      </button>

      {message && <p className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-[12px] font-semibold leading-5 text-emerald-900">{message}</p>}
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-[12px] font-semibold leading-5 text-destructive">{error}</p>}
      <Note>운영 DB 접속정보는 설치 파일에 포함하지 않습니다. 필요하면 사용자 설정 파일 `~/.config/tuntun-dev-study/db-sync.env`에서 연결값을 덮어쓸 수 있습니다.</Note>
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
