import type { NextRequest } from "next/server";

import { updateSessionAndProfileGate } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSessionAndProfileGate(request);
}

export const config = {
  matcher: [
    "/",
    "/report/:path*",
    "/map/:path*",
    "/photos/:path*",
    "/rules/:path*",
    "/onboarding/:path*",
  ],
};
