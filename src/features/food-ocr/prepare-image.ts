import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 0.85;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

/**
 * 촬영한 이미지를 분석 요청에 맞게 준비한다: 긴 변을 2000px로 리사이즈하고
 * JPEG 0.85 품질로 저장한다(설계 7.3, 이미지는 절대 서버로 전송하지 않고
 * OCR 입력으로만 쓴다). 처리가 끝나면 원본 파일은 삭제한다.
 *
 * EXIF(위치정보 포함)는 소스 코드 상으로는 재첨부되지 않는다 — iOS는
 * `UIImage.jpegData(compressionQuality:)`
 * (node_modules/expo-image-manipulator/ios/ImageManipulatorUtils.swift:76),
 * Android는 `Bitmap.compress()`
 * (node_modules/expo-image-manipulator/android/src/main/java/expo/modules/
 * imagemanipulator/ImageManipulatorModule.kt:120)를 쓰는데 둘 다 픽셀
 * 데이터만 새로 인코딩하고 원본 EXIF 딕셔너리를 복사하는 코드가 없다.
 * 다만 이는 소스 코드 확인이며, 실제 기기에서 결과 파일의 EXIF 유무를
 * 직접 검증한 것은 아니다 — 개발 빌드로 수동 확인이 필요하다.
 */
export async function prepareImage(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const isLandscape = width >= height;

  const context = ImageManipulator.manipulate(uri);
  const resizedContext = isLandscape
    ? context.resize({ width: Math.min(width, MAX_LONG_EDGE) })
    : context.resize({ height: Math.min(height, MAX_LONG_EDGE) });

  const rendered = await resizedContext.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  try {
    new File(uri).delete();
  } catch {
    // 원본 삭제 실패는 무시한다 — 남더라도 cleanupStaleImages가 다음 실행 시 정리한다.
  }

  return result.uri;
}
