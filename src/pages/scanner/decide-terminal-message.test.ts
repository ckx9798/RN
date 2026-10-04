import { decideTerminalMessage } from './decide-terminal-message';

describe('decideTerminalMessage', () => {
  it('권한이 거부된 상태면 SCAN_FAILED(permission_denied)를 반환한다', () => {
    const message = decideTerminalMessage('req-12345678', { permissionDenied: true, error: null });

    expect(message).toEqual({
      version: 1,
      type: 'SCAN_FAILED',
      requestId: 'req-12345678',
      code: 'permission_denied',
    });
  });

  it('권한 거부와 오류가 동시에 있으면 권한 거부를 우선한다', () => {
    const message = decideTerminalMessage('req-12345678', { permissionDenied: true, error: 'ocr_failed' });

    expect(message.type).toBe('SCAN_FAILED');
    expect((message as { code: string }).code).toBe('permission_denied');
  });

  it('OCR 실패 오류가 있으면 SCAN_FAILED(ocr_failed)를 반환한다', () => {
    const message = decideTerminalMessage('req-12345678', { permissionDenied: false, error: 'ocr_failed' });

    expect(message).toEqual({
      version: 1,
      type: 'SCAN_FAILED',
      requestId: 'req-12345678',
      code: 'ocr_failed',
    });
  });

  it('이미지 처리 실패 오류가 있으면 SCAN_FAILED(invalid_image)를 반환한다', () => {
    const message = decideTerminalMessage('req-12345678', { permissionDenied: false, error: 'invalid_image' });

    expect(message).toEqual({
      version: 1,
      type: 'SCAN_FAILED',
      requestId: 'req-12345678',
      code: 'invalid_image',
    });
  });

  it('권한 거부도 오류도 없으면 SCAN_CANCELLED를 반환한다', () => {
    const message = decideTerminalMessage('req-12345678', { permissionDenied: false, error: null });

    expect(message).toEqual({
      version: 1,
      type: 'SCAN_CANCELLED',
      requestId: 'req-12345678',
    });
  });
});
