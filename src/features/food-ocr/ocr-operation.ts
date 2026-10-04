import { extractLabelFields, type LabelFields } from './extract-label-fields';

export type OcrOutcome = { ok: true; fields: LabelFields } | { ok: false; code: 'invalid_image' | 'ocr_failed' };

type OcrDependencies = {
  prepare(uri: string): Promise<string>;
  recognize(uri: string): Promise<string>;
  images: { track(uri: string): void; release(uri: string): Promise<void> };
};

/** 작업별 파일 소유권: 취소된 작업은 새 촬영의 파일에 접근하지 않는다. */
export function createOcrOperation(deps: OcrDependencies) {
  const owned = new Set<string>();
  let cancelled = false;
  const track = (uri: string) => { owned.add(uri); deps.images.track(uri); };
  async function release() {
    const uris = Array.from(owned);
    owned.clear();
    await Promise.all(uris.map((uri) => deps.images.release(uri)));
  }
  async function run(uri: string): Promise<OcrOutcome | null> {
    track(uri);
    try {
      if (cancelled) return null;
      let prepared: string;
      try {
        prepared = await deps.prepare(uri);
      } catch {
        return cancelled ? null : { ok: false, code: 'invalid_image' };
      }
      track(prepared);
      if (cancelled) return null;
      try {
        const text = await deps.recognize(prepared);
        return cancelled ? null : { ok: true, fields: extractLabelFields(text) };
      } catch {
        return cancelled ? null : { ok: false, code: 'ocr_failed' };
      }
    } finally {
      await release();
    }
  }
  async function cancel() { cancelled = true; await release(); }
  return { run, cancel, isCancelled: () => cancelled };
}
