import { createTempImageStore, type FileOps } from './temp-image-store';

function makeFakeOps(): { ops: FileOps; deletedUris: string[] } {
  const deletedUris: string[] = [];
  const ops: FileOps = {
    async delete(uri: string) {
      deletedUris.push(uri);
    },
    async listCacheDirs() {
      return [];
    },
  };
  return { ops, deletedUris };
}

describe('createTempImageStore', () => {
  it('track한 URI를 releaseAll이 모두 삭제한다', async () => {
    const { ops, deletedUris } = makeFakeOps();
    const store = createTempImageStore(ops);

    store.track('file:///cache/a.jpg');
    store.track('file:///cache/b.jpg');
    await store.releaseAll();

    expect(deletedUris.sort()).toEqual(['file:///cache/a.jpg', 'file:///cache/b.jpg']);
  });

  it('releaseAll 이후에는 추적 목록이 비워져 다시 호출해도 삭제하지 않는다', async () => {
    const { ops, deletedUris } = makeFakeOps();
    const store = createTempImageStore(ops);

    store.track('file:///cache/a.jpg');
    await store.releaseAll();
    await store.releaseAll();

    expect(deletedUris).toEqual(['file:///cache/a.jpg']);
  });

  it('일부 삭제가 실패해도 나머지를 계속 삭제하고 throw하지 않으며, 실패 건수만 로그로 남긴다', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const deletedUris: string[] = [];
    const ops: FileOps = {
      async delete(uri: string) {
        if (uri === 'file:///cache/fails.jpg') {
          throw new Error('delete failed');
        }
        deletedUris.push(uri);
      },
      async listCacheDirs() {
        return [];
      },
    };
    const store = createTempImageStore(ops);

    store.track('file:///cache/fails.jpg');
    store.track('file:///cache/ok.jpg');

    await expect(store.releaseAll()).resolves.toBeUndefined();
    expect(deletedUris).toEqual(['file:///cache/ok.jpg']);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/1건/));
    expect(consoleWarnSpy.mock.calls[0][0]).not.toContain('fails.jpg');

    consoleWarnSpy.mockRestore();
  });

  it('cleanupStale이 Camera·ImageManipulator 캐시 디렉터리 항목을 모두 삭제한다', async () => {
    const deletedUris: string[] = [];
    const ops: FileOps = {
      async delete(uri: string) {
        deletedUris.push(uri);
      },
      async listCacheDirs() {
        return ['file:///cache/Camera/1.jpg', 'file:///cache/ImageManipulator/2.jpg'];
      },
    };
    const store = createTempImageStore(ops);

    await store.cleanupStale();

    expect(deletedUris.sort()).toEqual(['file:///cache/Camera/1.jpg', 'file:///cache/ImageManipulator/2.jpg']);
  });

  it('cleanupStale 중 일부 삭제가 실패해도 나머지를 계속 삭제한다', async () => {
    const deletedUris: string[] = [];
    const ops: FileOps = {
      async delete(uri: string) {
        if (uri.includes('bad')) {
          throw new Error('delete failed');
        }
        deletedUris.push(uri);
      },
      async listCacheDirs() {
        return ['file:///cache/Camera/bad.jpg', 'file:///cache/Camera/good.jpg'];
      },
    };
    const store = createTempImageStore(ops);

    await expect(store.cleanupStale()).resolves.toBeUndefined();
    expect(deletedUris).toEqual(['file:///cache/Camera/good.jpg']);
  });
});
