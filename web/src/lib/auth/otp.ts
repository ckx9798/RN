const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;

/**
 * 이메일 입력값을 정규화한다. 앞뒤 공백을 제거하고 소문자로 바꾼 뒤
 * 간단한 형식을 검사한다. 형식이 올바르지 않으면 null을 반환한다.
 */
export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === 0 || !EMAIL_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * OTP 입력값을 정규화한다. 공백을 모두 제거한 뒤 숫자 6자리인지
 * 확인한다. 숫자 6자리가 아니면 null을 반환한다.
 */
export function normalizeOtp(input: string): string | null {
  const digitsOnly = input.replace(/\s+/g, "");

  if (!/^\d+$/.test(digitsOnly) || digitsOnly.length !== OTP_LENGTH) {
    return null;
  }

  return digitsOnly;
}
