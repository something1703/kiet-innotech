import { liveApi } from "./live";
import type { StudentApi } from "./types";

export { ApiError } from "./types";

let chosen: StudentApi = liveApi;

// Mock mode: the in-browser mock, loaded on first use. NEXT_PUBLIC_API_MODE is replaced at build time, so in a
// live build this block is dead code and the mock (where anyone can sign in as anyone) is left out entirely.
if (process.env.NEXT_PUBLIC_API_MODE === "mock") {
  const mock = () => import("./mock").then((module) => module.mockApi);
  chosen = new Proxy({} as StudentApi, {
    get: (_, method: keyof StudentApi) =>
      async (...args: unknown[]) => ((await mock())[method] as (...args: unknown[]) => Promise<unknown>)(...args),
  });
}

/** The backend the portal talks to: the in-browser mock only when NEXT_PUBLIC_API_MODE=mock, FastAPI otherwise. */
export const api = chosen;
