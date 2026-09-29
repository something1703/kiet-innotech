import { apiMode } from "../auth/session";
import { liveApi } from "./live";
import { mockApi } from "./mock";

export { ApiError } from "./types";

/** The backend the portal talks to: the in-browser mock in development, FastAPI when NEXT_PUBLIC_API_MODE=live. */
export const api = apiMode === "live" ? liveApi : mockApi;
