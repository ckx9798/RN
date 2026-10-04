# web

하이브리드 식품 분석 MVP의 웹 앱입니다. Expo 앱이 WebView로 이 앱을
호스팅하며, 로그인과 분석 화면 등 사용자 상호작용은 이 웹 앱이 담당합니다.

## 개발

```bash
npm install
cp .env.example .env.local  # 값 채우기
npm run dev
```

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
