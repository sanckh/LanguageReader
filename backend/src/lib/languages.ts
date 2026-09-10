import type { AdminClient } from "./supabase.js";
import type {
  LanguageDto,
  LanguageOnboarding,
  LanguageSelection,
} from "../interfaces/language.js";
import { ensureProfileId, getProfile } from "./profile.js";

export class InvalidLanguageSelection extends Error {}

interface LanguageRecord {
  id: string;
  code: string;
  name: string;
  capabilities: { native?: boolean; learning?: boolean };
}

function toDto(record: LanguageRecord): LanguageDto {
  return { code: record.code, name: record.name };
}

async function listLanguages(client: AdminClient): Promise<LanguageRecord[]> {
  const { data, error } = await client
    .from("language")
    .select("id, code, name, capabilities")
    .order("name");
  if (error) throw new Error(error.message);
  return data as LanguageRecord[];
}

export async function readLanguageOnboarding(
  client: AdminClient,
  authUserId: string,
): Promise<LanguageOnboarding> {
  const languages = await listLanguages(client);
  const byId = new Map(languages.map((language) => [language.id, language]));
  const profile = await getProfile(client, authUserId);
  const chosen = (id: string | null | undefined): LanguageDto | null => {
    const record = id ? byId.get(id) : undefined;
    return record ? toDto(record) : null;
  };
  return {
    options: {
      native: languages
        .filter((language) => language.capabilities?.native)
        .map(toDto),
      learning: languages
        .filter((language) => language.capabilities?.learning)
        .map(toDto),
    },
    selection: {
      native: chosen(profile?.native_language_id),
      learning: chosen(profile?.learning_language_id),
    },
  };
}

export async function setLanguageSelection(
  client: AdminClient,
  authUserId: string,
  nativeCode: string,
  learningCode: string,
): Promise<LanguageSelection> {
  const languages = await listLanguages(client);
  const byCode = new Map(
    languages.map((language) => [language.code, language]),
  );
  const native = byCode.get(nativeCode);
  const learning = byCode.get(learningCode);
  if (!native?.capabilities?.native)
    throw new InvalidLanguageSelection("Unsupported native language");
  if (!learning?.capabilities?.learning)
    throw new InvalidLanguageSelection("Unsupported learning language");
  const profileId = await ensureProfileId(client, authUserId);
  const { error } = await client
    .from("user_profile")
    .update({
      native_language_id: native.id,
      learning_language_id: learning.id,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  return { native: toDto(native), learning: toDto(learning) };
}
