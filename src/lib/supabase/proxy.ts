import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig, hasSupabaseConfig } from "./config";

const ONBOARDING_PATH = "/onboarding";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function updateSessionAndProfileGate(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const pathname = request.nextUrl.pathname;
  const isOnboarding = pathname === ONBOARDING_PATH;
  const isEditingProfile =
    isOnboarding && request.nextUrl.searchParams.get("edit") === "1";

  if (!userId) {
    if (isOnboarding) {
      return supabaseResponse;
    }

    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = ONBOARDING_PATH;
    onboardingUrl.search = "";
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(onboardingUrl),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile && !isOnboarding) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = ONBOARDING_PATH;
    onboardingUrl.search = "";
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(onboardingUrl),
    );
  }

  if (
    profile &&
    isOnboarding &&
    !isEditingProfile &&
    request.method !== "POST"
  ) {
    const reportUrl = request.nextUrl.clone();
    reportUrl.pathname = "/report";
    reportUrl.search = "";
    return copyResponseCookies(supabaseResponse, NextResponse.redirect(reportUrl));
  }

  return supabaseResponse;
}
