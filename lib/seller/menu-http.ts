import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { MENU_LIMITS, MenuError } from "./menu-contract";
import { SellerMenuServices } from "@/services/seller-menu.service";
export async function menuRequest(request: Request, params: Promise<{ restaurantId: string; itemId?: string }>, write = false) {
  try {
    if (write && !isSameOrigin(request)) throw new MenuError("MENU_FORBIDDEN", 403);
    const client = await createClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) throw new MenuError("UNAUTHORIZED", 401);
    const { restaurantId, itemId } = await params;
    let result;
    if (write) {
      // Enforce byte limit while streaming, not only the untrusted Content-Length header.
      const reader = request.body?.getReader();
      let size = 0, raw = ""; const decoder = new TextDecoder();
      if (!reader) throw new MenuError("VALIDATION_ERROR");
      try {
        for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
          if (size > MENU_LIMITS.body) { await reader.cancel(); throw new MenuError("PAYLOAD_TOO_LARGE", 413); }
          raw += decoder.decode(chunk.value, { stream: true }); }
        raw += decoder.decode();
      } finally { reader.releaseLock(); }
      let input; try { input = JSON.parse(raw); } catch { throw new MenuError("VALIDATION_ERROR"); }
      result = await SellerMenuServices.write(client, restaurantId, itemId, input);
    } else result = await SellerMenuServices.read(client, restaurantId, itemId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof MenuError ? error : new MenuError("MENU_READ_FAILED", 503);
    return NextResponse.json({ error: { code: failure.code, ...(failure.issue ? { issue: failure.issue } : {}) } }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
