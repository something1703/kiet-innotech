import { API_MODE } from "../auth/session";
import type { AdminApi } from "./contract";
import { liveApi } from "./live";
import { mockApi } from "./mock";

/** The API the panel talks to: the in-browser mock by default, the FastAPI backend when NEXT_PUBLIC_API_MODE=live. */
export const api: AdminApi = API_MODE === "live" ? liveApi : mockApi;

export { ApiError, errorMessage, DEFAULT_PAGE_SIZE } from "./contract";
export type { AdminApi } from "./contract";
