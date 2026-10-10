export type Trial = {
  id: string;
  name: string;
  inclusion: string[];
  exclusion: string[];
};

export type Study = {
  id: string;
  slug: string;
  name: string;
  trials: Trial[];
  created_at: string;
};

export type ScreeningSession = {
  id: string;
  study_id: string;
  status: "started" | "completed" | "needs_review";
  elevenlabs_conversation_id: string | null;
  answers: Record<string, unknown>;
  match_results: MatchResult[];
  created_at: string;
  updated_at: string;
};

export type MatchResult = {
  trialId: string;
  trialName: string;
  status: "potential_match" | "needs_information" | "possible_exclusion";
  reason: string;
};
