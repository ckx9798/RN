// 설계 문서와 작업 브리프가 금지하는 단정적 문구가 소스 코드 어디에도
// 남지 않도록 강제하는 회귀 테스트다. `web/src` 아래 모든 .ts/.tsx 파일의
// 문자열 리터럴·JSX 텍스트를 읽어 검사한다. 이 파일 자신(금지어 목록을
// 정의하는 줄)은 검사 대상에서 제외한다.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_WORDS = ["안심", "안전", "섭취 적합"];
const SRC_ROOT = join(__dirname, "..", "..");
const SELF_FILENAME = "copy-guard.test.ts";

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("금지어 검사", () => {
  it("web/src 아래 어떤 소스 파일에도 금지 문구가 없다", () => {
    const files = collectSourceFiles(SRC_ROOT).filter((file) => !file.endsWith(SELF_FILENAME));

    const violations: { file: string; line: number; word: string }[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const word of FORBIDDEN_WORDS) {
          if (line.includes(word)) {
            violations.push({ file, line: index + 1, word });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
