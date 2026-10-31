import type { SupabaseClient } from "@supabase/supabase-js";

// Application guard; không thay thế quyền sở hữu/RLS hoặc điều kiện bên trong RPC.
export async function assertPurchaseAccess(client: SupabaseClient, expectedUserId?: string): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || (expectedUserId !== undefined && data.user.id !== expectedUserId)) {
    throw new Error("Vui lòng đăng nhập đúng tài khoản để mua hàng.");
  }
  const { data: profile, error: profileError } = await client.from("users").select("role,status").eq("id", data.user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active" || !["student", "staff"].includes(profile.role)) {
    throw new Error("Tài khoản không được phép mua hàng.");
  }
  return data.user.id;
}
