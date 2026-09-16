import { existsSync } from "node:fs";

const SRC = new URL("../src/", import.meta.url);

/** Maps the `@/…` tsconfig alias onto `src/…` so tests can import app modules. */
export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = new URL(specifier.slice(2), SRC);
  for (const candidate of [base, new URL(`${base.pathname}.ts`, SRC), new URL(`${base.pathname}.tsx`, SRC)]) {
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(base.href, context);
}
