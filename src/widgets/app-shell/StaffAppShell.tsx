import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { APP_PROFILE, STAFF_MODULES, type StaffViewId } from "../../shared/config/app-modules";
import { useAuthStore } from "../../features/auth/auth-store";
import { ContentRefreshProvider } from "../../shared/lib/content-refresh";
import { RailToggleProvider } from "../../shared/lib/rail-toggle";
import HospitalMark from "../../shared/ui/HospitalMark";
import { useDraftDocumentCount } from "../../features/hospital-playbook/queries";
import { usePendingHandoffCount } from "../../features/handoff/queries";

const APP_VERSION = __APP_VERSION__;

// 레일 상태 키를 버전업해, 복사된 앱/이전 빌드의 접힘 상태가 새 앱을 가리지 않게 한다.
const RAIL_COLLAPSED_KEY = "tuntun.kiosk.railCollapsed.v2";

/**
 * 직원 콘솔 셸. 참조앱(tc-dx-mybatis) 레일 구조를 병원 브랜드로 옮겼다.
 * 좌측 레일 = 모듈 + 하단 계정, 우상단 = 창 조작 버튼.
 */
function StaffAppShell({
  active,
  onSelect,
  children,
}: {
  active: StaffViewId;
  onSelect: (id: StaffViewId) => void;
  children: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  // 노트 트리는 노트 화면과 같은 캐시를 쓰므로 배지 때문에 요청이 늘지 않는다.
  const badgesEnabled = active !== "settings" && active !== "profile";
  const draftCount = useDraftDocumentCount(badgesEnabled);
  const pendingHandoffCount = usePendingHandoffCount(badgesEnabled);
  const badgeCounts: Partial<Record<StaffViewId, number>> = {
    playbook: draftCount,
    handoff: pendingHandoffCount,
  };
  const badgeTitles: Partial<Record<StaffViewId, string>> = {
    playbook: "승인 대기 문서",
    handoff: "대기 중인 직원 연결 요청",
  };
  const signOut = useAuthStore((s) => s.signOut);
  const [accountOpen, setAccountOpen] = useState(false);
  // 본문을 넓게 쓰려고 레일을 접을 수 있다. 다음 실행에도 상태를 유지한다.
  const [railCollapsed, setRailCollapsed] = useState(() => localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");

  function toggleRail() {
    setRailCollapsed((collapsed) => {
      localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "0" : "1");
      if (!collapsed) setAccountOpen(false);
      return !collapsed;
    });
  }
  const accountRef = useRef<HTMLDivElement>(null);

  // 참조앱과 동일한 소프트 새로고침: 본문을 key 로 리마운트하고 650ms 동안 스피너를 돌린다.
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [isRefreshingContent, setIsRefreshingContent] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);

  function refreshContent() {
    if (isRefreshingContent) return;
    setIsRefreshingContent(true);
    setContentRefreshKey((key) => key + 1);
    refreshTimerRef.current = window.setTimeout(() => {
      setIsRefreshingContent(false);
      refreshTimerRef.current = null;
    }, 650);
  }

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const displayName = user?.username || user?.email || "직원";
  const roleName = user?.role?.name ?? "직원";

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const railTint = (percent: number) =>
    `color-mix(in srgb, var(--primary-foreground) ${percent}%, transparent)`;

  return (
    <div className="relative flex h-screen overflow-hidden">
      <nav
        aria-hidden={railCollapsed}
        className={
          "relative z-50 flex shrink-0 flex-col items-center overflow-visible text-text-on-brand transition-[width] duration-200 ease-in-out " +
          (railCollapsed ? "w-0" : "w-[72px]")
        }
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 82%, black) 100%)",
        }}
      >
        <div
          className="flex h-12 w-full shrink-0 items-center justify-center border-b"
          style={{ borderColor: railTint(10) }}
        >
          {/* 이모지는 OS 폰트에 따라 뭉개진다. 병원 심볼(파비콘과 같은 축약형)로 교체. */}
          <HospitalMark inverted className="h-[34px] w-[34px] shrink-0 shadow-sm" />
          <span className="sr-only">{APP_PROFILE.hospitalName}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-1.5">
          {STAFF_MODULES.map((module) => {
            const isActive = module.id === active;
            return (
              <button
                key={module.id}
                onClick={() => onSelect(module.id)}
                title={module.ready ? module.label : `${module.label} (준비 중)`}
                className={
                  "group relative flex h-[44px] w-[50px] flex-col items-center justify-center gap-0.5 transition-all duration-300 ease-in-out " +
                  (isActive ? "rounded-[15px]" : "rounded-[24px] hover:rounded-[15px]") +
                  (module.ready ? "" : " opacity-55")
                }
                style={{ backgroundColor: isActive ? railTint(25) : undefined }}
              >
                <span
                  className={
                    "absolute -left-2.5 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-text-on-brand transition-all duration-300 ease-in-out " +
                    (isActive ? "h-6" : "h-0 group-hover:h-3")
                  }
                />
                {(badgeCounts[module.id] ?? 0) > 0 && (
                  /* 직원이 놓치기 쉬운 일(미승인 초안, 대기 중인 호출)의 개수를 메뉴에 직접 얹는다. */
                  <span
                    title={`${badgeTitles[module.id]} ${badgeCounts[module.id]}건`}
                    className="absolute right-0 top-0 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-surface-raised px-1 text-[9px] font-black tabular-nums text-brand-primary shadow-sm"
                  >
                    {badgeCounts[module.id]! > 99 ? "99+" : badgeCounts[module.id]}
                  </span>
                )}
                <module.icon className="size-[18px] shrink-0" strokeWidth={2} />
                <span className="w-full overflow-hidden px-0.5 text-center text-[9px] font-semibold leading-[1.05] [word-break:keep-all]">
                  {module.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          ref={accountRef}
          className="relative flex w-full flex-wrap items-center justify-center gap-1.5 border-t px-1 py-2"
          style={{ borderColor: railTint(10) }}
        >
          <span
            title={`${APP_PROFILE.displayName} v${APP_VERSION}`}
            className="max-h-3 select-none overflow-hidden text-[9px] font-bold tabular-nums"
            style={{ color: railTint(85) }}
          >
            v{APP_VERSION}
          </span>

          <button
            onClick={() => onSelect("settings")}
            title="설정"
            className={
              "flex h-[34px] w-[34px] items-center justify-center transition-all duration-200 " +
              (active === "settings" ? "rounded-[14px]" : "rounded-[20px] hover:rounded-[14px]")
            }
            style={{ backgroundColor: active === "settings" ? railTint(25) : undefined }}
          >
            <Settings className="size-[18px]" strokeWidth={2} />
          </button>

          <button
            onClick={() => setAccountOpen((open) => !open)}
            title={`${displayName} · ${roleName}`}
            className={
              "grid h-[34px] w-[34px] place-items-center rounded-lg border p-0 transition-all " +
              (accountOpen
                ? "bg-surface-raised shadow-lg"
                : "border-transparent bg-transparent hover:bg-[color-mix(in_srgb,var(--primary-foreground)_20%,transparent)]")
            }
            style={{ borderColor: accountOpen ? railTint(60) : undefined }}
          >
            <span className="grid h-[28px] w-[28px] place-items-center overflow-hidden rounded-full border bg-surface-raised text-[11px] font-black uppercase text-text-primary"
                  style={{ borderColor: railTint(30) }}>
              {displayName.charAt(0) || "U"}
            </span>
          </button>

          {accountOpen && (
            <div className="absolute bottom-[52px] left-[64px] z-50 w-[200px] rounded-lg border border-surface-border bg-surface-raised p-1.5 text-text-primary shadow-xl">
              <div className="border-b border-surface-border-soft px-2.5 py-2">
                <p className="truncate text-[13px] font-black">{displayName}</p>
                <p className="truncate text-[11px] font-semibold text-text-secondary">{roleName}</p>
              </div>
              <button
                onClick={() => {
                  setAccountOpen(false);
                  onSelect("profile");
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-surface-muted"
              >
                <User className="size-4" /> 내 정보
              </button>
              <button
                onClick={() => {
                  setAccountOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" /> 로그아웃
              </button>
            </div>
          )}
        </div>
      </nav>

      <ContentRefreshProvider value={{ refresh: refreshContent, isRefreshing: isRefreshingContent }}>
        <RailToggleProvider value={{ collapsed: railCollapsed, toggle: toggleRail }}>
          <div
            key={contentRefreshKey}
            className={
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-opacity duration-300 " +
              (isRefreshingContent ? "opacity-60" : "opacity-100")
            }
          >
            {children}
          </div>
        </RailToggleProvider>
      </ContentRefreshProvider>

    </div>
  );
}

export default StaffAppShell;
