/** The sandbox's own controls (the backend answers 404 unless it runs SANDBOX_MODE). */
import { ApiError } from "./api/contract";
import { send } from "./api/live";
import { getSession } from "./auth/session";

export type SandboxReset = { teams: number; judges: number; room: string; note: string };

/** Wipes the sandbox and fills it again with ten made-up teams in one room, scoring open. Super admins only. */
export async function resetSandbox(): Promise<SandboxReset> {
  const session = getSession();
  if (!session) throw new ApiError(401, "Your session has ended. Sign in again.");
  return (await send("POST", "/sandbox/reset", { token: session.token })) as SandboxReset;
}
