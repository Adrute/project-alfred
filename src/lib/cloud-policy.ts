import { loadConfig } from "@/config/env";
import { HttpError } from "@/domain/auth";
export function requireCloudAi() {
  if (!loadConfig().CLOUD_AI_ENABLED) throw new HttpError(403, "Las integraciones externas están desactivadas hasta completar su revisión.");
}
