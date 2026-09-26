import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

let client: SupabaseClient<Database> | undefined;

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !key ||
    url.includes("placeholder") ||
    key.includes("placeholder")
  ) {
    throw new Error("Chưa cấu hình Supabase trong file .env.local.");
  }

  return {
    url: url.replace(/\/$/, ""),
    key,
  };
}

export function getSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("Client này chỉ sử dụng trong trình duyệt.");
  }

  if (!client) {
    const { url, key } = getSupabaseConfig();

    client = createClient<Database>(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}