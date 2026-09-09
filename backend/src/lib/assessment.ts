import type { AdminClient } from "./supabase.js";
import type {
  AssessmentDto,
  OnboardingResponse,
} from "../interfaces/assessment.js";
import type { AssessmentStatus } from "../models/assessment.js";
import { getProfile } from "./profile.js";

export class LanguageNotSelected extends Error {}

const ASSESSMENT_COLUMNS = "id, status, completed_at, language(code, name)";

interface AssessmentRow {
  id: string;
  status: AssessmentStatus;
  completed_at: string | null;
  language: { code: string; name: string };
}

function toDto(row: AssessmentRow): AssessmentDto {
  return {
    id: row.id,
    status: row.status,
    completedAt: row.completed_at,
    language: { code: row.language.code, name: row.language.name },
  };
}

async function activeAssessment(
  client: AdminClient,
  profileId: string,
): Promise<AssessmentRow | null> {
  const { data, error } = await client
    .from("assessment")
    .select(ASSESSMENT_COLUMNS)
    .eq("user_id", profileId)
    .eq("status", "in_progress")
    .limit(1);
  if (error) throw new Error(error.message);
  // A many-to-one embed returns one object at runtime despite the array type.
  return (data as unknown as AssessmentRow[])[0] ?? null;
}

export async function readOnboarding(
  client: AdminClient,
  authUserId: string,
): Promise<OnboardingResponse> {
  const profile = await getProfile(client, authUserId);
  if (!profile) return { state: "not_started", assessment: null };
  const active = await activeAssessment(client, profile.id);
  if (active) return { state: "in_progress", assessment: toDto(active) };
  const { data, error } = await client
    .from("assessment")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "completed")
    .limit(1);
  if (error) throw new Error(error.message);
  const completed = (data as { id: string }[]).length > 0;
  return { state: completed ? "completed" : "not_started", assessment: null };
}

export async function startOnboarding(
  client: AdminClient,
  authUserId: string,
): Promise<OnboardingResponse> {
  const profile = await getProfile(client, authUserId);
  if (!profile?.learning_language_id) throw new LanguageNotSelected();
  const active = await activeAssessment(client, profile.id);
  if (active) return { state: "in_progress", assessment: toDto(active) };
  const { data, error } = await client
    .from("assessment")
    .insert({
      user_id: profile.id,
      language_id: profile.learning_language_id,
      status: "in_progress",
    })
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return {
    state: "in_progress",
    assessment: toDto(data as unknown as AssessmentRow),
  };
}
