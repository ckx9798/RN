import { MAX_BRIDGE_MESSAGE_BYTES, type ScanResultV1 } from '@/shared/config/bridge-contract';

import { byteLength } from './validate-message';

/**
 * 직렬화한 SCAN_RESULT가 MAX_BRIDGE_MESSAGE_BYTES를 넘으면 payload.rawText만
 * 잘라서 상한 이하로 맞춘다. rawText는 OCR 원문 보조 필드라 다른 구조화
 * 필드(제품명·원재료 등)보다 먼저 줄여도 손실이 가장 적다. 한글은
 * UTF-8에서 3바이트이므로 8000자 제한을 지킨 ingredientsText 등 다른
 * 필드만으로도 rawText 없이 상한에 근접할 수 있어 이분 탐색으로 안전하게
 * 맞는 길이를 찾는다.
 */
export function fitScanResultToLimit(msg: ScanResultV1): ScanResultV1 {
  if (byteLength(JSON.stringify(msg)) <= MAX_BRIDGE_MESSAGE_BYTES) {
    return msg;
  }

  const fits = (rawText: string) =>
    byteLength(JSON.stringify({ ...msg, payload: { ...msg.payload, rawText } })) <= MAX_BRIDGE_MESSAGE_BYTES;

  // 서로게이트 쌍을 분리하지 않도록 코드 포인트 단위로 자른다.
  const chars = Array.from(msg.payload.rawText);

  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(chars.slice(0, mid).join(''))) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return { ...msg, payload: { ...msg.payload, rawText: chars.slice(0, low).join('') } };
}
