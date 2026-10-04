import { useCallback, useEffect, useRef, useState } from 'react';

import type { LabelFields } from './extract-label-fields';
import { mergeLabelFields } from './merge-label-fields';
import { createOcrOperation } from './ocr-operation';
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
  const operationRef = useRef<ReturnType<typeof createOcrOperation> | null>(null);
  const cancelOperation = useCallback(async () => {
    const operation = operationRef.current;
    operationRef.current = null;
    await operation?.cancel();
  }, []);
  useEffect(() => () => { void cancelOperation(); }, [cancelOperation]);

  const capture = useCallback(
    async (uri: string) => {
      const side = step === 'product' || step === 'ingredients' ? step : 'ingredients';

      void cancelOperation();
      const operation = createOcrOperation({ prepare: prepareImage, recognize: recognizeText, images: tempImageStore });
      operationRef.current = operation;
      setError(null);
      setStep('processing');

      const outcome = await operation.run(uri);
      if (!outcome || operation.isCancelled() || operationRef.current !== operation) return;
      operationRef.current = null;

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
    [step, cancelOperation],
  );

  const skipProduct = useCallback(() => {
    void cancelOperation();
    productFieldsRef.current = null;
    setError(null);
    setStep('ingredients');
  }, [cancelOperation]);

  const retake = useCallback(async (side: 'product' | 'ingredients') => {
    void cancelOperation();
    if (side === 'product') {
      productFieldsRef.current = null;
    }
    setError(null);
    setFields(null);
    setStep(side);
  }, [cancelOperation]);

  const reset = useCallback(async () => {
    const cleanup = cancelOperation();
    productFieldsRef.current = null;
    setFields(null);
    setError(null);
    setStep('product');
    await cleanup;
  }, [cancelOperation]);

  return { step, capture, skipProduct, retake, fields, error, reset };
}
