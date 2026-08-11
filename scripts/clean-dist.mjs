import { rmSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const workspaceRoot = resolve(".");
for (const target of ["dist", "node_modules/.vite"]) {
  const resolvedTarget = resolve(target);
  const relativeTarget = relative(workspaceRoot, resolvedTarget);
  if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error(`Refusing to remove a path outside the workspace: ${resolvedTarget}`);
  }
  rmSync(resolvedTarget, { recursive: true, force: true });
}
