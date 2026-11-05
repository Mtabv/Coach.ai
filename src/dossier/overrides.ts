import type { DossierContent } from './model';

/**
 * Trainertextänderungen werden als Pfad → Text gespeichert und auf den generierten
 * Inhalt angewendet. Pfadformat: `<slideKey>.<feld>[.<index>][.<feld>]`,
 * z. B. `auftrag.messages.0.text` oder `soSpieltGegner.phases.2.value.text`.
 */
export function applyOverrides(content: DossierContent, overrides: Record<string, string>): DossierContent {
  const out = structuredClone(content);
  for (const [path, value] of Object.entries(overrides)) {
    const [slideKey, ...rest] = path.split('.');
    const slide = out.slides.find((s) => s.key === slideKey) as unknown as Record<string, unknown> | undefined;
    if (!slide || rest.length === 0) continue;
    setPath(slide, rest, value);
  }
  return out;
}

function setPath(obj: Record<string, unknown>, path: string[], value: string) {
  let cur: unknown = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') return;
    cur = (cur as Record<string, unknown>)[path[i]];
  }
  if (cur === null || typeof cur !== 'object') return;
  const last = path[path.length - 1];
  const target = cur as Record<string, unknown>;
  if (!(last in target) && !Array.isArray(target)) return;
  target[last] = value;
  // Bearbeiteter Text eines gekennzeichneten Werts wird zur Trainerangabe –
  // Konflikt- und Veraltet-Markierungen bleiben jedoch immer erhalten.
  if (last === 'text' && typeof target.flag === 'string' && ['offen', 'beispiel', 'ok'].includes(target.flag as string)) {
    target.flag = 'trainer';
  }
}

export function getPath(content: DossierContent, path: string): string | undefined {
  const [slideKey, ...rest] = path.split('.');
  let cur: unknown = content.slides.find((s) => s.key === slideKey);
  for (const p of rest) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}
