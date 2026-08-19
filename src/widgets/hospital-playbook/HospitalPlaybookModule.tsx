import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, FileText, GitBranch, Loader2, Plus, RefreshCw } from "lucide-react";
import PageHeader from "../../shared/ui/PageHeader";
import { useColumnResize } from "../../shared/lib/useColumnResize";
import ColumnResizeHandle from "../../shared/ui/ColumnResizeHandle";
import { playbookApi, type PlaybookCategory, type PlaybookDocumentSummary } from "../../features/hospital-playbook/api";
import { PLAYBOOK_TREE_KEY, usePlaybookTree } from "../../features/hospital-playbook/queries";
import DocumentDrawer from "./DocumentDrawer";
import DocumentPage from "./DocumentPage";
import DocumentPane from "./DocumentPane";
import ListColumn from "./ListColumn";

const CATEGORY_WIDTH_KEY = "tuntun-dev-study-category-width";
const TOPIC_WIDTH_KEY = "tuntun-dev-study-topic-width";

function storedWidth(key: string, fallback: number) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? Math.min(560, Math.max(240, value)) : fallback;
}

function flattenDocuments(documents: PlaybookDocumentSummary[]) {
  const children = new Map<number, PlaybookDocumentSummary[]>();
  const roots: PlaybookDocumentSummary[] = [];
  for (const document of documents) {
    if (document.parentId === null) roots.push(document);
    else children.set(document.parentId, [...(children.get(document.parentId) ?? []), document]);
  }
  const rows: Array<{ document: PlaybookDocumentSummary; depth: number; indexPath: number[] }> = [];
  const visit = (items: PlaybookDocumentSummary[], depth: number, parentPath: number[]) => {
    items.forEach((document, index) => {
      const indexPath = [...parentPath, index + 1];
      rows.push({ document, depth, indexPath });
      visit(children.get(document.id) ?? [], depth + 1, indexPath);
    });
  };
  visit(roots, 0, []);
  return { rows, children };
}

function HospitalPlaybookModule() {
  const queryClient = useQueryClient();
  const tree = usePlaybookTree();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null);
  const [drawerDocumentId, setDrawerDocumentId] = useState<number | null>(null);
  const [pageDocumentId, setPageDocumentId] = useState<number | null>(null);
  const [expandedDocumentIds, setExpandedDocumentIds] = useState<Set<number>>(() => new Set());
  const [dragDocumentId, setDragDocumentId] = useState<number | null>(null);
  const [categoryWidth, setCategoryWidth] = useState(() => storedWidth(CATEGORY_WIDTH_KEY, 280));
  const [topicWidth, setTopicWidth] = useState(() => storedWidth(TOPIC_WIDTH_KEY, 300));

  const categories: PlaybookCategory[] = tree.data ?? [];
  const category = useMemo(() => categories.find((item) => item.id === categoryId) ?? null, [categories, categoryId]);
  const topic = useMemo(() => category?.topics.find((item) => item.id === topicId) ?? null, [category, topicId]);
  const documents = topic?.documents ?? [];
  const { rows: documentRows, children } = useMemo(() => flattenDocuments(documents), [documents]);
  const drawerDocument = useQuery({
    queryKey: ["hospital-playbook", "document", drawerDocumentId],
    queryFn: () => playbookApi.document(drawerDocumentId!),
    enabled: drawerDocumentId !== null,
  });

  const resizeCategory = useColumnResize(categoryWidth, setCategoryWidth, { min: 240, max: 560 });
  const resizeTopic = useColumnResize(topicWidth, setTopicWidth, { min: 260, max: 600 });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: PLAYBOOK_TREE_KEY });

  useEffect(() => { window.localStorage.setItem(CATEGORY_WIDTH_KEY, String(categoryWidth)); }, [categoryWidth]);
  useEffect(() => { window.localStorage.setItem(TOPIC_WIDTH_KEY, String(topicWidth)); }, [topicWidth]);
  useEffect(() => {
    if (!categories.length) return setCategoryId(null);
    if (!categories.some((item) => item.id === categoryId)) setCategoryId(categories[0].id);
  }, [categories, categoryId]);
  useEffect(() => {
    const topics = category?.topics ?? [];
    if (!topics.length) return setTopicId(null);
    if (!topics.some((item) => item.id === topicId)) setTopicId(topics[0].id);
  }, [category, topicId]);
  useEffect(() => {
    const ids = new Set(documents.map((item) => item.id));
    setExpandedDocumentIds((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [documents]);

  const createCategory = useMutation({ mutationFn: (title: string) => playbookApi.createCategory(title), onSuccess: invalidate });
  const renameCategory = useMutation({ mutationFn: (value: { id: number; title: string }) => playbookApi.renameCategory(value.id, value.title), onSuccess: invalidate });
  const deleteCategory = useMutation({ mutationFn: (id: number) => playbookApi.deleteCategory(id), onSuccess: invalidate });
  const reorderCategories = useMutation({ mutationFn: (ids: number[]) => playbookApi.reorderCategories(ids), onSuccess: invalidate });
  const createTopic = useMutation({ mutationFn: (value: { categoryId: number; title: string }) => playbookApi.createTopic(value.categoryId, value.title), onSuccess: invalidate });
  const renameTopic = useMutation({ mutationFn: (value: { id: number; title: string }) => playbookApi.renameTopic(value.id, value.title), onSuccess: invalidate });
  const deleteTopic = useMutation({ mutationFn: (id: number) => playbookApi.deleteTopic(id), onSuccess: invalidate });
  const reorderTopics = useMutation({ mutationFn: (value: { categoryId: number; ids: number[] }) => playbookApi.reorderTopics(value.categoryId, value.ids), onSuccess: invalidate });
  const createDocument = useMutation({
    mutationFn: (value: { topicId: number; parentId: number | null }) => playbookApi.createDocument(value.topicId, "새 문서", value.parentId),
    onSuccess: (document) => { invalidate(); setEditingDocumentId(document.id); },
  });
  const deleteDocument = useMutation({
    mutationFn: (id: number) => playbookApi.deleteDocument(id),
    onSuccess: () => { setDrawerDocumentId(null); setEditingDocumentId(null); invalidate(); },
  });
  const reorderDocuments = useMutation({
    mutationFn: (value: { topicId: number; ids: number[]; parentId: number | null }) => playbookApi.reorderDocuments(value.topicId, value.ids, value.parentId),
    onSuccess: invalidate,
  });

  const isVisible = (document: PlaybookDocumentSummary) => {
    let parentId = document.parentId;
    while (parentId !== null) {
      if (!expandedDocumentIds.has(parentId)) return false;
      parentId = documents.find((item) => item.id === parentId)?.parentId ?? null;
    }
    return true;
  };
  const createNewDocument = (parentId: number | null = null) => { if (topic) createDocument.mutate({ topicId: topic.id, parentId }); };
  const dropDocument = (target: PlaybookDocumentSummary) => {
    if (!topic || dragDocumentId === null || dragDocumentId === target.id) return;
    const source = documents.find((item) => item.id === dragDocumentId);
    if (!source || source.parentId !== target.parentId) return;
    const siblings = documents.filter((item) => item.parentId === source.parentId);
    const from = siblings.findIndex((item) => item.id === source.id);
    const to = siblings.findIndex((item) => item.id === target.id);
    const next = [...siblings];
    next.splice(to, 0, ...next.splice(from, 1));
    reorderDocuments.mutate({ topicId: topic.id, ids: next.map((item) => item.id), parentId: source.parentId });
    setDragDocumentId(null);
  };

  const detail = drawerDocument.data;
  const flatDocuments = documentRows.map((row) => row.document);
  const detailIndex = detail ? flatDocuments.findIndex((item) => item.id === detail.id) : -1;
  const previous = detailIndex > 0 ? flatDocuments[detailIndex - 1] : undefined;
  const next = detailIndex >= 0 ? flatDocuments[detailIndex + 1] : undefined;

  if (pageDocumentId !== null && topic && category) {
    return <DocumentPage
      documentId={pageDocumentId}
      categoryTitle={category.title}
      topicTitle={topic.title}
      categoryId={category.id}
      topicId={topic.id}
      categories={categories}
      documents={documents}
      onClose={() => setPageDocumentId(null)}
      onNavigate={setPageDocumentId}
      onChangeLocation={(nextCategoryId, nextTopicId, nextDocumentId) => {
        setCategoryId(nextCategoryId);
        setTopicId(nextTopicId);
        setPageDocumentId(nextDocumentId);
      }}
      onReorder={(ids, parentId) => reorderDocuments.mutateAsync({ topicId: topic.id, ids, parentId })}
      onRefresh={() => void tree.refetch()}
      onEdit={(id) => { setPageDocumentId(null); setEditingDocumentId(id); }}
      onDelete={(id) => { setPageDocumentId(null); setDrawerDocumentId(id); }}
      deleting={deleteDocument.isPending}
      reordering={reorderDocuments.isPending}
    />;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* 노트 트리만 다시 불러온다. 셸의 전역 새로고침은 본문을 리마운트해 선택 상태까지 초기화하므로 여기서는 감춘다. */}
      <PageHeader hideRefresh>
        <FileText className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">개발 학습 노트</span>
        <button type="button" onClick={() => void tree.refetch()} disabled={tree.isFetching} className="ui-icon-button ml-1 size-7 disabled:opacity-40" title="노트 새로고침"><RefreshCw className={`size-3.5 ${tree.isFetching ? "animate-spin" : ""}`} /></button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-4">
        {tree.isPending ? <div className="grid h-full place-items-center text-text-muted"><Loader2 className="size-6 animate-spin" /></div> : tree.isError ? <div className="grid h-full place-items-center text-sm font-semibold text-text-muted">노트를 불러오지 못했습니다.</div> : (
          <main className="flex h-full min-h-[640px] min-w-[960px] gap-0">
            <div className="min-h-0 shrink-0" style={{ width: categoryWidth }}><ListColumn title="1차 노트 영역" items={categories.map((item) => ({ id: item.id, title: item.title }))} selectedId={categoryId} onSelect={setCategoryId} onCreate={(title) => createCategory.mutate(title)} onRename={(id, title) => renameCategory.mutate({ id, title })} onDelete={(id) => deleteCategory.mutate(id)} onReorder={(ids) => reorderCategories.mutate(ids)} emptyLabel="아직 영역이 없습니다." createPlaceholder="영역 이름" /></div>
            <ColumnResizeHandle onMouseDown={resizeCategory} />
            <div className="min-h-0 shrink-0" style={{ width: topicWidth }}><ListColumn title="2차 노트 주제" items={(category?.topics ?? []).map((item) => ({ id: item.id, title: item.title, badge: <FileText className="size-4 shrink-0 text-brand-primary" /> }))} selectedId={topicId} onSelect={setTopicId} onCreate={(title) => category && createTopic.mutate({ categoryId: category.id, title })} onRename={(id, title) => renameTopic.mutate({ id, title })} onDelete={(id) => deleteTopic.mutate(id)} onReorder={(ids) => category && reorderTopics.mutate({ categoryId: category.id, ids })} emptyLabel={category ? "아직 주제가 없습니다." : "먼저 영역을 선택하세요."} createPlaceholder="주제 이름" disabled={!category} /></div>
            <ColumnResizeHandle onMouseDown={resizeTopic} />
            <section className="flex min-h-0 min-w-[420px] flex-1 flex-col rounded-lg border border-surface-border bg-surface-raised shadow-sm">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border-soft px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-brand-primary">
                    {category?.title ?? "영역 없음"} &gt; {topic?.title ?? "주제 없음"}
                  </p>
                  <h1 className="mt-0.5 truncate text-lg font-black text-text-primary">
                    {topic?.title ?? "주제를 선택하세요"}
                    {topic && (
                      <span className="ml-2 text-sm font-semibold text-text-muted">
                        ({documents.length})
                      </span>
                    )}
                  </h1>
                </div>
                <button
                  type="button"
                  disabled={!topic || createDocument.isPending}
                  onClick={() => createNewDocument()}
                  className="ui-icon-button-brand h-9 shrink-0 gap-1.5 px-3 text-[13px] font-black disabled:opacity-40"
                >
                  <Plus className="size-4" /> 문서 추가
                </button>
              </header>
              {editingDocumentId ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="mb-2 flex justify-end">
                    <button type="button" onClick={() => setEditingDocumentId(null)} className="ui-icon-button h-8 px-3 text-xs font-black">
                      목록으로
                    </button>
                  </div>
                  <DocumentPane documentId={editingDocumentId} onChanged={invalidate} />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {documentRows.length ? (
                    <div className="space-y-1.5">
                      {documentRows.map(({ document, depth, indexPath }) => {
                        const childCount = children.get(document.id)?.length ?? 0;
                        const hasChildren = childCount > 0;
                        const expanded = expandedDocumentIds.has(document.id);
                        return (
                          <div
                            key={document.id}
                            draggable
                            onDragStart={() => setDragDocumentId(document.id)}
                            onDragEnd={() => setDragDocumentId(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => dropDocument(document)}
                            className={(isVisible(document) ? "flex animate-sub-doc-fade-in" : "hidden") + " min-h-12 items-center gap-2 rounded-md border border-surface-border-soft bg-surface-muted px-2.5 transition hover:border-brand-border"}
                            style={{ marginLeft: `${depth * 24}px` }}
                          >
                            <span className="cursor-grab text-text-muted" title="드래그하여 같은 단계에서 순서 변경">⠿</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDocumentId(null);
                                setDrawerDocumentId(document.id);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-surface-border-soft bg-surface-raised text-[11px] font-black text-text-muted">
                                {indexPath.join(".")}
                              </span>
                              <FileText className="size-4 shrink-0 text-brand-primary" />
                              {depth > 0 && <span className="text-xs font-bold text-brand-primary">ㄴ</span>}
                              <span className="truncate text-sm font-black text-text-primary">
                                {document.title}
                                {hasChildren && (
                                  <span className="ml-1.5 text-xs font-bold text-text-muted">
                                    ({childCount})
                                  </span>
                                )}
                              </span>
                            </button>
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedDocumentIds((current) => {
                                    const nextIds = new Set(current);
                                    if (nextIds.has(document.id)) nextIds.delete(document.id);
                                    else nextIds.add(document.id);
                                    return nextIds;
                                  })
                                }
                                className="ui-icon-button size-7"
                                title={expanded ? "하위 문서 접기" : "하위 문서 펼치기"}
                              >
                                <ChevronRight className={(expanded ? "rotate-90 " : "") + "size-4 transition-transform"} />
                              </button>
                            )}
                            {depth < 1 && (
                              <button
                                type="button"
                                onClick={() => createNewDocument(document.id)}
                                className="ui-icon-button size-7 text-brand-primary"
                                title="하위 문서 추가"
                              >
                                <GitBranch className="size-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPageDocumentId(document.id)}
                              className="ui-icon-button size-7"
                              title="전체 페이지로 보기"
                            >
                              <ExternalLink className="size-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid min-h-48 place-items-center text-sm font-semibold text-text-muted">
                      문서를 추가해 학습 흐름을 구성하세요.
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
      {drawerDocument.isPending && drawerDocumentId !== null && <div className="fixed inset-0 z-50 grid place-items-center bg-black/20"><Loader2 className="size-7 animate-spin text-brand-primary" /></div>}
      {detail && <DocumentDrawer document={detail} previous={previous ? { ...detail, id: previous.id, title: previous.title } : undefined} next={next ? { ...detail, id: next.id, title: next.title } : undefined} onNavigate={(target) => setDrawerDocumentId(target.id)} onChanged={invalidate} onOpenPage={() => { setDrawerDocumentId(null); setPageDocumentId(detail.id); }} onDelete={() => deleteDocument.mutate(detail.id)} onClose={() => setDrawerDocumentId(null)} deleting={deleteDocument.isPending} deleteError={deleteDocument.isError ? (deleteDocument.error as Error).message : undefined} />}
    </div>
  );
}

export default HospitalPlaybookModule;
