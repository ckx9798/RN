// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// FSD 레이어 의존 방향 강제.
// 근거: docs/superpowers/specs/2026-09-22-fsd-structure-design.md "규칙 강제 수단"
// 의존 방향: app -> pages -> widgets -> features -> shared

// 전역: 배럴(index.ts)을 우회해 슬라이스 내부 구현 파일을 직접 임포트하는 것을 금지한다.
const barrelBypassPatterns = [
  {
    group: ['@/pages/*/**'],
    message: "pages 슬라이스 내부 경로 대신 '@/pages/<slice>' public API를 임포트하세요.",
  },
  {
    group: ['@/widgets/*/**'],
    message: "widgets 슬라이스 내부 경로 대신 '@/widgets/<slice>' public API를 임포트하세요.",
  },
  {
    group: ['@/features/*/**'],
    message: "features 슬라이스 내부 경로 대신 '@/features/<slice>' public API를 임포트하세요.",
  },
];

const forbidPages = {
  group: ['@/pages/*'],
  message: '이 레이어에서 pages를 임포트할 수 없습니다 (app → pages → widgets → features → shared).',
};
const forbidWidgets = {
  group: ['@/widgets/*'],
  message: '이 레이어에서 widgets를 임포트할 수 없습니다 (app → pages → widgets → features → shared).',
};
const forbidFeatures = {
  group: ['@/features/*'],
  message: '이 레이어에서 features를 임포트할 수 없습니다 (app → pages → widgets → features → shared).',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'web/**', 'supabase/**', '.worktrees/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: barrelBypassPatterns }],
    },
  },
  {
    // widgets: pages를 임포트할 수 없다.
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...barrelBypassPatterns, forbidPages] }],
    },
  },
  {
    // features: pages, widgets를 임포트할 수 없다.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...barrelBypassPatterns, forbidPages, forbidWidgets] },
      ],
    },
  },
  {
    // shared: pages, widgets, features 중 어느 것도 임포트할 수 없다.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...barrelBypassPatterns, forbidPages, forbidWidgets, forbidFeatures] },
      ],
    },
  },
]);
