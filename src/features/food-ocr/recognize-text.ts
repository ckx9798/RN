import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

/** OCR 인식 실패(네이티브 모듈 오류, 인식 결과 없음 등) 시 던진다. */
export class OcrError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'OcrError';
    this.cause = options?.cause;
  }
}

/**
 * OCR 래퍼(@react-native-ml-kit/text-recognition)가 네이티브에 링크되지 않은
 * 환경(예: Expo Go, 개발 빌드 이전)에서 호출되면 던진다. 조용히 폴백하지
 * 않고 명시적으로 실패를 알린다.
 */
export class OcrUnavailableError extends OcrError {
  constructor(options?: { cause?: unknown }) {
    super('OCR 모듈을 사용할 수 없어요. 개발 빌드가 필요해요.', options);
    this.name = 'OcrUnavailableError';
  }
}

// @react-native-ml-kit/text-recognition은 네이티브 모듈이 링크되지 않으면
// (Expo Go, 개발 빌드 이전) 이 메시지로 시작하는 오류를 던진다. 조용한
// 폴백 대신 OcrUnavailableError로 구분해 드러낸다.
const LINKING_ERROR_PREFIX = "The package '@react-native-ml-kit/text-recognition' doesn't seem to be linked";

/**
 * 이미지에서 한국어 텍스트를 인식한다. Google ML Kit Text Recognition v2의
 * 한글 스크립트를 사용한다(설계 7.2). 이미지 URI·Base64는 반환값에도, 이
 * 함수 밖으로도 전달하지 않는다 — 반환값은 인식된 텍스트뿐이다.
 */
export async function recognizeText(uri: string): Promise<string> {
  try {
    const result = await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN);
    return result.text;
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith(LINKING_ERROR_PREFIX)) {
      throw new OcrUnavailableError({ cause });
    }
    throw new OcrError('OCR 텍스트 인식에 실패했어요.', { cause });
  }
}
