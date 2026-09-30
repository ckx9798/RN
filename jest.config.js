/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // '<rootDir>'로 앵커링한다: 이 저장소의 워크트리(.worktrees/<name>)는 그 자체가
  // rootDir이 되므로, 앵커 없는 '/.worktrees/' 패턴은 워크트리 내부에서 실행할 때
  // 모든 테스트 경로를 오탐으로 제외시킨다. 앵커링하면 "현재 rootDir 하위에 중첩된
  // 다른 워크트리"만 제외하고 워크트리 자신의 테스트는 정상 실행된다.
  testPathIgnorePatterns: ['/node_modules/', '/web/', '/supabase/', '<rootDir>/.worktrees/'],
};
