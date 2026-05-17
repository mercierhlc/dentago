const KEY = "dentago_getstarted_v1";

export type GetStartedStepId = "survey" | "gdc" | "supplier" | "search";

const STEP_SET = new Set<string>(["survey", "gdc", "supplier", "search"]);

function asStepId(x: string): GetStartedStepId | null {
  return STEP_SET.has(x) ? (x as GetStartedStepId) : null;
}

export type GetStartedSessionSnapshot = {
  done: GetStartedStepId[];
  activeStep: GetStartedStepId;
  connectTargets: string[];
};

export function loadGetStartedSessionCache(): GetStartedSessionSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (!j || typeof j.activeStep !== "string") return null;
    const rawDone = Array.isArray(j.done) ? j.done : [];
    const done = (rawDone as unknown[])
      .map((x) => (typeof x === "string" ? asStepId(x) : null))
      .filter((x): x is GetStartedStepId => x != null);
    const active = asStepId(j.activeStep);
    if (!active) return null;
    const rawCt = j.connectTargets ?? j.connect_targets;
    const connectTargets = Array.isArray(rawCt)
      ? rawCt.filter((x): x is string => typeof x === "string")
      : [];
    return {
      done,
      activeStep: active,
      connectTargets,
    };
  } catch {
    return null;
  }
}

export function saveGetStartedSessionCache(snapshot: GetStartedSessionSnapshot): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        done: snapshot.done,
        activeStep: snapshot.activeStep,
        connectTargets: snapshot.connectTargets,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearGetStartedSessionCache(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
