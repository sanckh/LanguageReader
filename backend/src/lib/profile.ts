import type { AdminClient } from "./supabase.js";

export interface ProfileRow {
  id: string;
  native_language_id: string | null;
  learning_language_id: string | null;
}

const PROFILE_COLUMNS = "id, native_language_id, learning_language_id";

export async function getProfile(
  client: AdminClient,
  authUserId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await client
    .from("user_profile")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
}

export async function ensureProfileId(
  client: AdminClient,
  authUserId: string,
): Promise<string> {
  const existing = await getProfile(client, authUserId);
  if (existing) return existing.id;
  const { data, error } = await client
    .from("user_profile")
    .insert({ auth_user_id: authUserId })
    .select("id")
    .single();
  if (!error) return (data as { id: string }).id;
  const retry = await getProfile(client, authUserId);
  if (retry) return retry.id;
  throw new Error(error.message);
}
