import { useQuery } from "@tanstack/react-query";
import { playbookApi, type PlaybookCategory } from "./api";

/** 노트 트리 캐시 키. 셸(배지)과 노트 화면이 같은 응답을 공유한다. */
export const PLAYBOOK_TREE_KEY = ["hospital-playbook", "tree"];

export function usePlaybookTree() {
  return useQuery({ queryKey: PLAYBOOK_TREE_KEY, queryFn: playbookApi.tree });
}

/** 승인 대기(초안) 문서 수. 직원이 놓치기 쉬운 "승인 안 한 문서"를 레일에 배지로 띄운다. */
export function useDraftDocumentCount(): number {
  const tree = usePlaybookTree();
  return countDrafts(tree.data ?? []);
}

function countDrafts(categories: PlaybookCategory[]): number {
  let count = 0;
  for (const category of categories) {
    for (const topic of category.topics) {
      for (const document of topic.documents) {
        if (document.status === "DRAFT") count += 1;
      }
    }
  }
  return count;
}
