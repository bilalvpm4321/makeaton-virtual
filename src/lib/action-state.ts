export type ActionState =
  | { error?: string; success?: string; fieldErrors?: Record<string, string> }
  | undefined;
