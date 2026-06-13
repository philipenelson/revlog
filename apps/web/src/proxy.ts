import { NextResponse, type NextRequest } from "next/server";

const REFRESH_COOKIE = "refreshToken";

export function proxy(request: NextRequest) {
  if (!request.cookies.get(REFRESH_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/garage/:path*"],
};
