# Android preview 빌드 설정

- 날짜: 2026-10-07
- PR 번호: #5
- PR 링크: https://github.com/ckx9798/RN/pull/5
- 상태: 병합
- 관련 설계: 없음
- 관련 구현 계획: 없음

## 작업 배경

내부 QA에서 개발 서버 없이 Android 기기에 앱을 설치해 확인할 방법이
없었다. 저장소에는 확정된 `eas.json`이 없었다.

## 작업 목표

EAS로 내부 배포용 Android APK를 빌드할 수 있는 최소 설정을 갖춘다.

## 작업 범위

- `eas.json` `preview` 빌드 프로필
- `app.json` Android 패키지, 카메라 권한, EAS 프로젝트 연결
- `docs/rules/release.md` 현재 프로필 범위 반영

## 주요 변경 사항

- `preview` 프로필은 internal 배포 APK를 만들고 development client를 쓰지
  않는다. 웹 앱 URL은 `EXPO_PUBLIC_WEB_APP_URL`로 공개된 Vercel 운영 주소를
  사용한다.
- Android 패키지 이름을 `com.ckx9798.rn`으로 정하고 카메라 권한을 선언했다.
- `extra.eas.projectId`로 EAS 프로젝트를 연결했다.

## 핵심 기술 결정

- 스토어 제출 없이 직접 설치하도록 AAB 대신 APK를 선택했다.
- `appVersionSource`는 `local`로 두어 버전을 app config에서 관리한다.
- development·production 프로필과 OTA 채널은 별도 설계와 승인을 거친다.

## 사용자 영향

앱 동작 변화는 없다. Android 테스트 APK를 EAS로 빌드할 수 있다.

## 검증 결과

- `git diff --check` 통과
- `app.json`, `eas.json` JSON 파싱 확인
- TypeScript·RN 코드 변경이 없어 `npx expo lint`, `npx tsc --noEmit`은
  실행하지 않았다.
- EAS Build는 실행하지 않았다.

## 제외 범위

- iOS preview 빌드 설정
- development·production 프로필과 EAS Update 채널

## 후속 작업

- `preview` 프로필로 실제 APK 빌드와 기기 설치 확인
