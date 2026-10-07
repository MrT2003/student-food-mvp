import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function hasGoogleIdentity(user: User) {
  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

export async function linkZaloAccount(admin: SupabaseClient, zaloId: string, userId: string) {
  const { error } = await admin.rpc("link_zalo_identity", { p_zalo_id: zaloId, p_user_id: userId });
  if (error) throw error;
}

async function resolveUser(admin: SupabaseClient, zaloId: string): Promise<string | null> {
  const { data, error } = await admin.rpc("resolve_zalo_user", { p_zalo_id: zaloId });
  if (error) throw error;
  if (data !== null && typeof data !== "string") throw new Error("INVALID_AUTH_RESPONSE");
  return data;
}

// Called only after the server has verified the Zalo OAuth code and fetched /me.
export async function loginWithVerifiedZalo(
  admin: SupabaseClient,
  sessionClient: SupabaseClient,
  profile: { id: string; name: string; img_url: string },
) {
  if (!/^\d{1,64}$/.test(profile.id)) throw new Error("INVALID_ZALO_ID");
  let userId = await resolveUser(admin, profile.id);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${profile.id}@zalo.app`, password: randomBytes(48).toString("base64url"),
      email_confirm: true,
    });
    if (error) {
      if (!["email_exists", "user_already_exists"].includes(error.code ?? "")) throw error;
      userId = await resolveUser(admin, profile.id);
    } else { userId = data.user?.id ?? null; }
  }
  if (!userId) throw new Error("USER_NOT_FOUND");
  const { data: auth, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !auth.user?.email) throw authError ?? new Error("USER_NOT_FOUND");

  // Only standalone Zalo accounts may initialize a missing public profile.
  if (auth.user.email === `${profile.id}@zalo.app`) {
    const { error } = await admin.from("users").upsert({
      id: userId, role: "student", name: profile.name, avatar_url: profile.img_url || null,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  }
  // Also checks active profile and ownership atomically, including legacy accounts.
  await linkZaloAccount(admin, profile.id, userId);

  // Issue a one-time Auth token for the SAME user, without changing their password.
  // This token never goes into a URL, response body, or logs, and no email is sent.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink", email: auth.user.email,
  });
  if (linkError || link.user?.id !== userId || !link.properties?.hashed_token) {
    throw linkError ?? new Error("AUTH_ACCOUNT_MISMATCH");
  }
  const { data: session, error: sessionError } = await sessionClient.auth.verifyOtp({
    type: "magiclink", token_hash: link.properties.hashed_token,
  });
  if (sessionError || session.user?.id !== userId) {
    throw sessionError ?? new Error("AUTH_ACCOUNT_MISMATCH");
  }
}
