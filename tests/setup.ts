import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const runtimeDirectory = path.join(os.tmpdir(), `alfred-vitest-${process.pid}`);
rmSync(runtimeDirectory, { force: true, recursive: true });
process.env.DATA_DIRECTORY = runtimeDirectory;

process.on("exit", () => {
  rmSync(runtimeDirectory, { force: true, recursive: true });
});
