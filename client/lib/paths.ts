/**
 * The static export uses trailing slashes (/team/), while links in the code are written without them (/team).
 * Compare paths with these helpers so both spellings match.
 */

/** "/team/" -> "/team"; "/" stays "/". */
export function normalisePath(path: string) {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** True when `pathname` is `path`, with or without a trailing slash. */
export function isPath(pathname: string | null, path: string) {
  return pathname !== null && normalisePath(pathname) === normalisePath(path);
}

/** True when `pathname` is `path` or a page below it, e.g. /team/new under /team. */
export function isUnder(pathname: string | null, path: string) {
  if (pathname === null) return false;
  const current = normalisePath(pathname);
  const base = normalisePath(path);
  return current === base || current.startsWith(`${base}/`);
}
