import { Check, ChevronLeft, ChevronRight, Clipboard, ExternalLink, Link2, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import type { PlaybookDocument } from "../../features/hospital-playbook/api";
import { playbookApi } from "../../features/hospital-playbook/api";
import { lexicalToMarkdown } from "../../features/hospital-playbook/lexicalToMarkdown";
import { ApiError, getApiBase } from "../../shared/api/client";
import { LexicalEditor } from "../../shared/ui/lexical/lexical-editor";
import { useToast } from "../../shared/ui/toast";
import DocumentComments from "./DocumentComments";
import DocumentPane from "./DocumentPane";

const DRAWER_SIZE_KEY = "tuntun-dev-study-document-drawer-size";
const DRAWER_SIZES = [
  { label: "S", value: 40 },
  { label: "M", value: 60 },
  { label: "L", value: 80 },
] as const;

async function copyToClipboard(value: string) {
  try {
    await writeClipboardText(value);
    return;
  } catch {
    // 웹 개발 서버에서는 Tauri 플러그인이 없을 수 있어 브라우저 방식으로 보완한다.
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("CLIPBOARD_UNAVAILABLE");
}

function storedDrawerSize() {
  const value = Number(window.localStorage.getItem(DRAWER_SIZE_KEY));
  return DRAWER_SIZES.some((size) => size.value === value) ? value : 60;
}

/** 문서를 읽고 같은 드로어 안에서 바로 수정할 수 있는 우측 드로어. */
function DocumentDrawer({
  document,
  previous,
  next,
  onNavigate,
  onDelete,
  onClose,
  onOpenPage,
  onChanged,
  deleting = false,
  deleteError,
}: {
  document: PlaybookDocument;
  previous?: PlaybookDocument;
  next?: PlaybookDocument;
  onNavigate: (document: PlaybookDocument) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenPage?: () => void;
  onChanged: () => void;
  deleting?: boolean;
  deleteError?: string;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [drawerSize, setDrawerSize] = useState(storedDrawerSize);
  const { showToast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [isIssuingAiToken, setIsIssuingAiToken] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [aiContentCopied, setAiContentCopied] = useState(false);

  useEffect(() => {
    setIsClosing(false);
    setIsEditing(false);
  }, [document.id]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const copyShareLink = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { token } = await playbookApi.shareDocument(document.id);
      const url = `${getApiBase()}/api/public/hospital-playbook/documents/${token}`;
      await copyToClipboard(url);
      setShareCopied(true);
      showToast("공유 링크를 복사했습니다.");
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (error) {
      showToast(error instanceof ApiError ? `공유 링크 발급 실패: ${error.message}` : "클립보드에 복사하지 못했습니다.", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const copyAiEditConnection = async () => {
    if (isIssuingAiToken) return;
    setIsIssuingAiToken(true);
    try {
      const issued = await playbookApi.issueAiEditToken(document.id);
      const apiBase = getApiBase();
      const endpoint = `${apiBase}/api/public/hospital-playbook/ai-edit/documents/${issued.documentId}`;
      const connection = [
        "TUNTUN AI EDIT CONNECTION",
        `documentId: ${issued.documentId}`,
        `expectedVersion: ${issued.expectedVersion}`,
        `expiresAt: ${issued.expiresAt}`,
        "",
        `GET ${endpoint}`,
        `PATCH ${endpoint}`,
        "Authorization: Bearer <TOKEN>",
        `TOKEN: ${issued.token}`,
        "",
        'PATCH body: {"title":"수정 제목","content":"수정 본문","expectedVersion":<CURRENT_VERSION>}',
        "이 토큰은 해당 문서에 한 번 저장한 뒤 폐기됩니다.",
      ].join("\n");
      await copyToClipboard(connection);
      showToast("AI 편집 연결 정보를 복사했습니다.");
    } catch (error) {
      showToast(error instanceof ApiError ? `AI 편집 토큰 발급 실패: ${error.message}` : "AI 편집 정보를 클립보드에 복사하지 못했습니다.", "error");
    } finally {
      setIsIssuingAiToken(false);
    }
  };

  const copyAiContent = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { token } = await playbookApi.shareDocument(document.id);
      const url = `${getApiBase()}/api/public/hospital-playbook/documents/${token}`;
      const markdown = lexicalToMarkdown(document.content);
      await copyToClipboard([`# ${document.title}`, "", markdown, "", "---", `원문 API: ${url}`].join("\n"));
      setAiContentCopied(true);
      showToast("AI용 Markdown 내용을 복사했습니다.");
      window.setTimeout(() => setAiContentCopied(false), 1800);
    } catch (error) {
      showToast(error instanceof ApiError ? `AI용 내용 발급 실패: ${error.message}` : "AI용 내용을 클립보드에 복사하지 못했습니다.", "error");
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/25 ${
        isClosing ? "animate-drawer-fade-out" : "animate-drawer-fade-in"
      }`}
      onMouseDown={handleClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${document.title} 상세 보기`}
        onMouseDown={(event) => event.stopPropagation()}
        className={`relative flex h-full w-full max-w-[760px] flex-col border-l border-surface-border bg-surface-raised shadow-2xl transition-[width] duration-300 ease-in-out ${
          isClosing ? "animate-drawer-slide-out" : "animate-drawer-slide-in"
        }`}
        style={{ width: `${drawerSize}vw`, maxWidth: "none" }}
      >
        {/* 패널 사이드 일체형 손잡이 탭 */}
        <div
          className="absolute left-0 top-32 z-10 flex -translate-x-full flex-col items-center rounded-l-xl border border-r-0 border-surface-border bg-surface-raised p-1 shadow-[-4px_0_14px_rgba(0,0,0,0.07)]"
          aria-label="드로워 크기 및 전체 페이지 열기"
        >
          {DRAWER_SIZES.map((size) => {
            const selected = drawerSize === size.value;
            return (
              <button
                key={size.label}
                type="button"
                aria-label={`드로워 크기 ${size.label} (${size.value}%)`}
                title={`너비 ${size.label} (${size.value}%)`}
                aria-pressed={selected}
                onClick={() => {
                  setDrawerSize(size.value);
                  window.localStorage.setItem(DRAWER_SIZE_KEY, String(size.value));
                }}
                className={`grid size-7.5 place-items-center rounded-lg text-xs font-black transition-all ${
                  selected
                    ? "bg-brand-primary text-white shadow-xs scale-105"
                    : "text-text-muted hover:bg-surface-muted hover:text-text-primary"
                }`}
              >
                {size.label}
              </button>
            );
          })}

          <div className="my-1 h-px w-5 bg-surface-border-soft" />
          <button
            type="button"
            aria-label="로그인 없이 읽는 API 링크 복사"
            title="로그인 없이 읽는 API 링크 복사"
            onClick={() => void copyShareLink()}
            disabled={isSharing}
            className="grid size-7.5 place-items-center rounded-lg text-text-muted transition-all hover:bg-brand-glass hover:text-brand-primary hover:scale-105 disabled:opacity-50"
          >
            {shareCopied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="AI용 Markdown 내용 복사"
            title="AI용 Markdown 내용 복사"
            onClick={() => void copyAiContent()}
            disabled={isSharing}
            className="grid size-7.5 place-items-center rounded-lg text-text-muted transition-all hover:bg-brand-glass hover:text-brand-primary hover:scale-105 disabled:opacity-50"
          >
            {aiContentCopied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="AI 편집 연결 정보 복사"
            title="AI 편집 연결 정보 복사 (작성자/관리자 전용)"
            onClick={() => void copyAiEditConnection()}
            disabled={isIssuingAiToken}
            className="grid size-7.5 place-items-center rounded-lg text-text-muted transition-all hover:bg-brand-glass hover:text-brand-primary hover:scale-105 disabled:opacity-50"
          >
            <Pencil className="size-3.5" />
          </button>

          {onOpenPage && (
            <>
              <div className="my-1 h-px w-5 bg-surface-border-soft" />
              <button
                type="button"
                aria-label="전체 페이지로 열기"
                title="전체 페이지로 열기"
                onClick={onOpenPage}
                className="grid size-7.5 place-items-center rounded-lg text-text-muted transition-all hover:bg-brand-glass hover:text-brand-primary hover:scale-105"
              >
                <ExternalLink className="size-3.5" />
              </button>
            </>
          )}
        </div>
        <header className="flex shrink-0 items-center gap-2 border-b border-surface-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-brand-primary">개발 노트 · {isEditing ? "수정" : "상세 보기"}</p>
            {!isEditing && <h2 className="mt-0.5 truncate text-lg font-black text-text-primary">{document.title}</h2>}
          </div>
          <button type="button" className={`ui-icon-button size-8 ${isEditing ? "bg-brand-primary text-white" : ""}`} onClick={() => setIsEditing(true)} title="수정">
            <Pencil className="size-4" />
          </button>
          {onOpenPage && <button type="button" className="ui-icon-button size-8" onClick={onOpenPage} title="전체 페이지로 보기">
            <ExternalLink className="size-4" />
          </button>}
          <button type="button" className="ui-icon-button size-8 text-brand-primary" onClick={() => void copyShareLink()} disabled={isSharing} title="로그인 없이 읽는 API 링크 복사">
            {shareCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          </button>
          <button type="button" className="ui-icon-button size-8" onClick={() => void copyAiContent()} disabled={isSharing} title="AI용 Markdown 내용 복사">
            {aiContentCopied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
          </button>
          <button type="button" className="ui-icon-button size-8 text-destructive" onClick={() => setDeleteConfirmOpen(true)} title="삭제">
            <Trash2 className="size-4" />
          </button>
          <button type="button" className="ui-icon-button size-8" onClick={handleClose} title="닫기">
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isEditing ? (
            <DocumentPane documentId={document.id} onChanged={onChanged} />
          ) : document.content.trim() ? (
            <div className="overflow-hidden rounded-lg border border-surface-border-soft bg-white">
              <LexicalEditor key={document.id} initialState={document.content} onChange={() => undefined} readOnly minHeight="240px" />
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-surface-border bg-surface-muted px-6 text-center">
              <div>
                <p className="text-sm font-black text-text-primary">아직 작성된 내용이 없습니다.</p>
                <p className="mt-1 text-xs font-semibold text-text-muted">상단의 수정 버튼을 눌러 학습 내용을 작성하세요.</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-right text-[11px] font-semibold text-text-muted">
            마지막 수정 {new Date(document.updatedAt).toLocaleString("ko-KR")}
          </p>
          <DocumentComments documentId={document.id} />
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-surface-border px-4 py-3">
          <button
            type="button"
            className="ui-icon-button h-9 gap-1.5 px-3 text-xs font-black disabled:opacity-35"
            onClick={() => previous && onNavigate(previous)}
            disabled={isEditing || !previous}
          >
            <ChevronLeft className="size-4" /> 이전 문서
          </button>
          <button
            type="button"
            className="ui-icon-button h-9 gap-1.5 px-3 text-xs font-black disabled:opacity-35"
            onClick={() => next && onNavigate(next)}
            disabled={isEditing || !next}
          >
            다음 문서 <ChevronRight className="size-4" />
          </button>
        </footer>

        {deleteConfirmOpen && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/30 p-5">
            <div className="w-full max-w-sm rounded-lg border border-surface-border bg-surface-raised p-5 shadow-xl">
              <h3 className="text-base font-black text-text-primary">문서를 삭제할까요?</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                <strong>{document.title}</strong> 문서를 삭제합니다. 하위 문서는 최상위 문서로 남습니다.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="ui-icon-button h-9 px-3 text-xs font-black">취소</button>
                <button type="button" disabled={deleting} onClick={onDelete} className="ui-icon-button-danger h-9 px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
              {deleteError && <p className="mt-3 text-xs font-bold text-destructive">{deleteError}</p>}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default DocumentDrawer;
