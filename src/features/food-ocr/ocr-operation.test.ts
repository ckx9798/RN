import { createOcrOperation } from './ocr-operation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

it('취소 후 생성된 이미지도 지우고 OCR 결과를 적용하지 않는다', async () => {
  const prepare = deferred<string>();
  const tracked = new Set<string>();
  const deleted: string[] = [];
  const recognize = jest.fn().mockResolvedValue('원재료: 밀');
  const task = createOcrOperation({ prepare: () => prepare.promise, recognize, images: {
    track: (uri) => { tracked.add(uri); },
    release: async (uri) => { tracked.delete(uri); deleted.push(uri); },
  } });
  const result = task.run('original');
  await task.cancel();
  prepare.resolve('late-prepared');
  expect(await result).toBeNull();
  expect(tracked.size).toBe(0);
  expect(deleted).toContain('late-prepared');
  expect(recognize).not.toHaveBeenCalled();
});

it('인식 중 취소된 이전 작업이 새 촬영 이미지를 삭제하지 않는다', async () => {
  const recognition = deferred<string>();
  const tracked = new Set<string>();
  const images = { track: (uri: string) => { tracked.add(uri); }, release: async (uri: string) => { tracked.delete(uri); } };
  const old = createOcrOperation({ prepare: async () => 'old-prepared', recognize: () => recognition.promise, images });
  const newer = createOcrOperation({ prepare: async () => 'new-prepared', recognize: () => new Promise<string>(() => {}), images });
  const oldResult = old.run('old-original');
  await Promise.resolve();
  await old.cancel();
  void newer.run('new-original');
  await Promise.resolve();
  recognition.resolve('이전 원문');
  expect(await oldResult).toBeNull();
  expect(tracked).toEqual(new Set(['new-original', 'new-prepared']));
  await newer.cancel();
});

it('성공과 실패 모두 자신이 만든 이미지를 정리한다', async () => {
  for (const fail of [false, true]) {
    const release = jest.fn().mockResolvedValue(undefined);
    const task = createOcrOperation({ prepare: async () => 'prepared', recognize: async () => {
      if (fail) throw new Error('failed');
      return '제품명: 과자\n원재료: 밀';
    }, images: { track: jest.fn(), release } });
    const result = await task.run('original');
    expect(result?.ok).toBe(!fail);
    expect(release).toHaveBeenCalledWith('original');
    expect(release).toHaveBeenCalledWith('prepared');
  }
});
