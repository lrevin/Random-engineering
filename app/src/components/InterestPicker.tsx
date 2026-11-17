import { DOMAINS, categoryById } from "@/data";
import { DomainPicker } from "./DomainPicker";

/** 고른 관심 분야 id(세부 분야 · 자격증)에서 큰 분야 id만 (세부 분야가 하나라도 있으면 그 분야를 고른 것으로) */
export const domainsOf = (value: string[]) => [...new Set(value.map((id) => categoryById(id)?.domain).filter((d): d is string => !!d))];

/**
 * 관심 분야 고르기 (설정 > 관심 분야). 세부 분야는 고르지 않고 항공우주공학 · 건축공학 같은 큰 분야만 고름.
 * 큰 분야를 켜면 그 분야의 세부 분야를 모두 넣고, 끄면 모두 뺌. 자격증 id는 그대로 둠.
 */
export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const chosen = domainsOf(value);
  const change = (next: string[]) => {
    const added = next.filter((d) => !chosen.includes(d)), removed = chosen.filter((d) => !next.includes(d));
    const cats = (d: string) => DOMAINS.find((x) => x.id === d)?.categories.map((c) => c.id) ?? [];
    const drop = new Set(removed.flatMap(cats));
    onChange([...new Set([...value.filter((id) => !drop.has(id)), ...added.flatMap(cats)])]);
  };
  return <DomainPicker value={chosen} onChange={change} />;
}
