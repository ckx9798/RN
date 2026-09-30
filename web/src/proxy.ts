import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session-proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 파일과 Next.js 내부 자원을 제외한 모든 경로에서 실행한다.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
