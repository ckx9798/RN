import { useCallback, useRef, useState } from 'react';

import { extractLabelFields, type LabelFields } from './extract-label-fields';
import { mergeLabelFields } from './merge-label-fields';
import { prepareImage } from './prepare-image';
import { recognizeText } from './recognize-text';
import { tempImageStore } from './temp-image-store';

export type OcrStep = 'product' | 'ingredients' | 'processing' | 'review';
export type OcrErrorCode = 'ocr_failed' | 'invalid_image';

type UseFoodOcrResult = {
  step: OcrStep;
  capture(uri: string): Promise<void>;
  skipProduct(): void;
  retake(side: 'product' | 'ingredients'): Promise<void>;
  fields: LabelFields | null;
  error: OcrErrorCode | null;
  reset(): Promise<void>;
};

type OcrOutcome = { ok: true; fields: LabelFields } | { ok: false; code: OcrErrorCode };

async function runOcr(uri: string): Promise<OcrOutcome> {
  let preparedUri: string;
  try {
    preparedUri = await prepareImage(uri);
  } catch {
    return { ok: false, code: 'invalid_image' };
  }
  tempImageStore.track(preparedUri);

  let rawText: string;
  try {
    rawText = await recognizeText(preparedUri);
  } catch {
    return { ok: false, code: 'ocr_failed' };
  }

  return { ok: true, fields: extractLabelFields(rawText) };
}

/**
 * 촬영 -> 이미지 준비 -> OCR -> 필드 추출 -> 교정 흐름을 관리한다
 * (설계 7장, 브리프 N3 use-food-ocr 인터페이스).
 * 제품 정보면은 건너뛸 수 있고, 원재료면은 필수다. 두 면의 결과는
 * mergeLabelFields로 합쳐 review 단계의 fields로 노출한다.
 */
export function useFoodOcr(): UseFoodOcrResult {
  const [step, setStep] = useState<OcrStep>('product');
  const [fields, setFields] = useState<LabelFields | null>(null);
  const [error, setError] = useState<OcrErrorCode | null>(null);
  const productFieldsRef = useRef<LabelFields | null>(null);

  const capture = useCallback(
    async (uri: string) => {
      const side = step === 'product' || step === 'ingredients' ? step : 'ingredients';

      tempImageStore.track(uri);
      setError(null);
      setStep('processing');

      const outcome = await runOcr(uri);

      if (!outcome.ok) {
        setError(outcome.code);
        setStep(side);
        return;
      }

      if (side === 'product') {
        productFieldsRef.current = outcome.fields;
        setStep('ingredients');
        return;
      }

      setFields(mergeLabelFields(productFieldsRef.current, outcome.fields));
      setStep('review');
    },
    [step],
  );

  const skipProduct = useCallback(() => {
    productFieldsRef.current = null;
    setError(null);
    setStep('ingredients');
  }, []);

  const retake = useCallback(async (side: 'product' | 'ingredients') => {
    if (side === 'product') {
      productFieldsRef.current = null;
    }
    setError(null);
    setFields(null);
    setStep(side);
  }, []);

  const reset = useCallback(async () => {
    await tempImageStore.releaseAll();
    productFieldsRef.current = null;
    setFields(null);
    setError(null);
    setStep('product');
  }, []);

  return { step, capture, skipProduct, retake, fields, error, reset };
}
