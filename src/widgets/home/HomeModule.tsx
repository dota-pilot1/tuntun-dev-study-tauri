import { LayoutDashboard, Loader2, MessageCircleQuestion, PhoneCall, ShieldCheck } from "lucide-react";
import PageHeader from "../../shared/ui/PageHeader";
import { useKioskSummary } from "../../features/analytics/queries";
import { useDraftDocumentCount } from "../../features/hospital-playbook/queries";
import type { StaffViewId } from "../../shared/config/app-modules";

/**
 * 직원 콘솔 홈. 소개 문구 대신 "지금 처리할 일"만 둔다.
 * 각 카드는 눌러서 해당 화면으로 넘어가는 진입점이기도 하다.
 */
function HomeModule({ onSelect }: { onSelect: (id: StaffViewId) => void }) {
  const summary = useKioskSummary();
  const draftCount = useDraftDocumentCount();
  const data = summary.data;

  return (
    <>
      <PageHeader>
        <LayoutDashboard className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">홈</span>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted">
        <div className="mx-auto w-full max-w-4xl px-5 py-6">
          <header>
            <h1 className="text-[18px] font-bold tracking-tight text-text-primary">오늘 현황</h1>
            <p className="mt-1 text-[12px] text-text-secondary">
              키오스크 응대 상태와 지금 처리해야 할 일을 모았습니다.
            </p>
          </header>

          {summary.isPending ? (
            <div className="grid place-items-center py-20 text-text-muted">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : summary.isError ? (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] font-semibold text-destructive">
              {summary.error instanceof Error ? summary.error.message : "오늘 현황을 불러오지 못했습니다."}
            </p>
          ) : (
            <>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                <ActionCard
                  icon={PhoneCall}
                  label="대기 중인 직원 호출"
                  value={data!.pendingHandoffs}
                  unit="건"
                  urgent={data!.pendingHandoffs > 0}
                  hint={`오늘 요청 ${data!.todayHandoffs}건`}
                  onClick={() => onSelect("handoff")}
                />
                <ActionCard
                  icon={ShieldCheck}
                  label="승인 대기 문서"
                  value={draftCount}
                  unit="건"
                  urgent={draftCount > 0}
                  hint="승인해야 챗봇이 근거로 씁니다"
                  onClick={() => onSelect("playbook")}
                />
                <ActionCard
                  icon={MessageCircleQuestion}
                  label="오늘 응대"
                  value={data!.todayQuestions}
                  unit="문항"
                  hint={
                    data!.answeredRate === null
                      ? `대화 ${data!.todaySessions}건`
                      : `답변률 ${data!.answeredRate}% · 대화 ${data!.todaySessions}건`
                  }
                  onClick={() => onSelect("chatbot")}
                />
              </div>

              <section className="mt-6">
                <h2 className="text-[14px] font-bold tracking-tight text-text-primary">
                  답하지 못한 질문
                </h2>
                <p className="mt-1 text-[12px] text-text-secondary">
                  최근 {data!.unansweredWindowDays}일 동안 챗봇이 근거를 찾지 못한 질문입니다. 노트에 문서를 추가하면
                  다음부터 답할 수 있습니다.
                </p>

                <div className="mt-3 space-y-2">
                  {data!.topUnanswered.length === 0 ? (
                    <p className="rounded-lg border border-surface-border-soft bg-surface-raised px-4 py-8 text-center text-[13px] font-semibold text-text-muted">
                      답하지 못한 질문이 없습니다.
                    </p>
                  ) : (
                    data!.topUnanswered.map((item) => (
                      <div
                        key={item.question}
                        className="flex items-center gap-3 rounded-lg border border-surface-border-soft bg-surface-raised px-4 py-3"
                      >
                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">
                          {item.question}
                        </p>
                        <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-text-secondary">
                          {item.count}회
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ActionCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  urgent = false,
  onClick,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: number;
  unit: string;
  hint: string;
  urgent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg border bg-surface-raised px-4 py-3.5 text-left transition-colors hover:border-brand-border " +
        (urgent ? "border-brand-border" : "border-surface-border-soft")
      }
    >
      <span className="flex items-center gap-1.5 text-[12px] font-bold text-text-secondary">
        <Icon className={`size-3.5 ${urgent ? "text-brand-primary" : "text-text-muted"}`} />
        {label}
      </span>
      <span className="mt-2 flex items-baseline gap-1">
        <span
          className={
            "text-[26px] font-black leading-none tabular-nums " +
            (urgent ? "text-brand-primary" : "text-text-primary")
          }
        >
          {value}
        </span>
        <span className="text-[12px] font-bold text-text-muted">{unit}</span>
      </span>
      <span className="mt-1.5 block text-[11px] font-semibold text-text-muted">{hint}</span>
    </button>
  );
}

export default HomeModule;
