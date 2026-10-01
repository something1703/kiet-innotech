import type { AdminApi } from "./contract";
import { liveApi } from "./live";

/**
 * Forwards every call to an API that is loaded on first use. Mock mode uses it for the in-browser
 * mock and its seed data, so they sit in their own chunk.
 */
function lazyApi(mode: AdminApi["mode"], load: () => Promise<AdminApi>): AdminApi {
  let loaded: Promise<AdminApi> | null = null;
  return new Proxy({ mode } as AdminApi, {
    get(target, prop: keyof AdminApi) {
      if (prop === "mode") return target.mode;
      return (...args: unknown[]) => (loaded ??= load()).then((api) => (api[prop] as (...a: unknown[]) => Promise<unknown>)(...args));
    },
  });
}

/**
 * The API the panel talks to: the FastAPI backend, or the in-browser mock when NEXT_PUBLIC_API_MODE=mock.
 * The condition reads the inlined env value directly (not API_MODE) so live builds drop the mock entirely.
 */
export const api: AdminApi =
  process.env.NEXT_PUBLIC_API_MODE === "mock" ? lazyApi("mock", () => import("./mock").then((m) => m.mockApi)) : liveApi;

export { ApiError, errorMessage, DEFAULT_PAGE_SIZE, MAX_SEARCH_LENGTH } from "./contract";
export type { AdminApi } from "./contract";
