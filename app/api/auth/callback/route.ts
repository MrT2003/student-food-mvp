import { NextResponse } from "next/server";

export function GET(request: Request) {
  const source = new URL(request.url);
  const destination = new URL("/auth/callback", source.origin);

  for (const key of ["code", "error", "error_description"]) {
    const value = source.searchParams.get(key);

    if (value) {
      destination.searchParams.set(key, value);
    }
  }

  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");

  return response;
}