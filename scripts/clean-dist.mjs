import { rmSync } from "node:fs";
import { resolve } from "node:path";

for (const target of ["dist", "node_modules/.vite"]) {
  rmSync(resolve(target), { recursive: true, force: true });
}
