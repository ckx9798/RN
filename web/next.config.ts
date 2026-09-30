import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web/ 자체가 독립 npm 프로젝트다. 상위 Expo 워크스페이스에도
  // package-lock.json이 있어 자동 감지가 잘못된 루트를 고를 수 있으므로
  // 명시적으로 고정한다.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
