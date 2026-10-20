import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);
const protectedBranches = new Set(["main", "master"]);
const allowedBranchPattern = /^(feature|fix|docs|chore|refactor|test|release)\/[a-z0-9][a-z0-9._-]*$/;

export function validateDevelopmentBranch(branch: string): string[] {
  const normalized = branch.trim();
  if (!normalized) return ["Git está en estado detached HEAD o no se pudo determinar la rama."];
  if (protectedBranches.has(normalized)) {
    return [`No se permite desarrollar directamente sobre la rama protegida '${normalized}'.`];
  }
  if (!allowedBranchPattern.test(normalized)) {
    return [
      `La rama '${normalized}' no sigue el formato permitido: feature/, fix/, docs/, chore/, refactor/, test/ o release/.`,
    ];
  }
  return [];
}

export async function currentGitBranch(root = process.cwd()) {
  const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
    cwd: path.resolve(root),
    windowsHide: true,
  });
  return stdout.trim();
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const branch = process.env.ALFRED_BRANCH_NAME?.trim() || await currentGitBranch();
    const failures = validateDevelopmentBranch(branch);
    if (failures.length) {
      console.error(failures.map((failure) => `- ${failure}`).join("\n"));
      process.exitCode = 1;
    } else {
      console.info(`Rama de trabajo válida: ${branch}`);
    }
  } catch (error) {
    console.error(`No se pudo comprobar la rama de Git: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
