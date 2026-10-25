import { loadConfig } from "@/config/env";
import { HttpError } from "@/domain/auth";
export function requireCloudAi() {
  if (!loadConfig().CLOUD_AI_ENABLED) throw new HttpError(403, "ChatGPT está desactivado mediante CLOUD_AI_ENABLED=false.");
}
