import { Directory, File, Paths } from 'expo-file-system';

/**
 * 임시 이미지 파일 삭제를 위한 최소 인터페이스. 네이티브 모듈(expo-file-system)에
 * 대한 의존을 분리해 순수 로직을 jest 환경에서 목(mock) 없이 테스트할 수 있게 한다.
 */
export type FileOps = {
  delete(uri: string): Promise<void>;
  /** 카메라·이미지 매니퓰레이터가 캐시에 남긴 항목(파일 URI 목록)을 조회한다. */
  listCacheDirs(): Promise<string[]>;
};

/**
 * 촬영·리사이즈 과정에서 생기는 임시 이미지의 수명을 추적한다.
 * - track: 삭제 대상 URI를 등록한다.
 * - releaseAll: 등록된 모든 URI를 삭제한다. 일부가 실패해도 나머지는 계속
 *   삭제하고 예외를 던지지 않는다(개인정보가 될 수 있는 URI·오류 내용은
 *   로그에 남기지 않고 실패 건수만 남긴다).
 * - cleanupStale: 이전 실행에서 남은 카메라·이미지 매니퓰레이터 캐시 항목을
 *   정리한다(앱 비정상 종료 대비, 설계 7.3).
 */
export function createTempImageStore(ops: FileOps) {
  const tracked = new Set<string>();

  function track(uri: string): void {
    tracked.add(uri);
  }

  async function releaseAll(): Promise<void> {
    const uris = Array.from(tracked);
    tracked.clear();

    let failed = 0;
    for (const uri of uris) {
      try {
        await ops.delete(uri);
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      // 실패 건수만 남기고 URI·오류 내용은 남기지 않는다.
      console.warn(`[food-ocr] 임시 이미지 ${failed}건 삭제 실패`);
    }
  }

  async function cleanupStale(): Promise<void> {
    const staleUris = await ops.listCacheDirs();
    for (const uri of staleUris) {
      try {
        await ops.delete(uri);
      } catch {
        // 개별 실패는 무시하고 나머지 정리를 계속한다.
      }
    }
  }

  return { track, releaseAll, cleanupStale };
}

// expo-file-system 기반 실제 구현.
// expo-camera(takePictureAsync)와 expo-image-manipulator(renderAsync/saveAsync)는
// 각각 앱 캐시 디렉터리 하위 `Camera/`, `ImageManipulator/`에 파일을 남긴다.
const STALE_CACHE_SUBDIRS = ['Camera', 'ImageManipulator'];

function listFileUrisIn(directory: Directory): string[] {
  if (!directory.exists) {
    return [];
  }
  return directory
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => file.uri);
}

const fileSystemOps: FileOps = {
  async delete(uri: string) {
    new File(uri).delete();
  },
  async listCacheDirs() {
    return STALE_CACHE_SUBDIRS.flatMap((name) => listFileUrisIn(new Directory(Paths.cache, name)));
  },
};

export const tempImageStore = createTempImageStore(fileSystemOps);

/** 앱 시작 시 호출한다: 이전 실행에서 지워지지 않고 남은 임시 이미지를 정리한다. */
export function cleanupStaleImages(): Promise<void> {
  return tempImageStore.cleanupStale();
}
