import { z } from "zod";

export const A2A_PROTOCOL_VERSION = "1.0";
export const A2A_MEDIA_TYPE = "application/a2a+json";

const textPartSchema = z.object({
  text: z.string().min(1).max(4_000),
}).passthrough();

const dataPartSchema = z.object({
  data: z.record(z.string(), z.unknown()),
}).passthrough();

export const a2aSendMessageRequestSchema = z.object({
  message: z.object({
    messageId: z.string().min(1).max(200),
    role: z.literal("ROLE_USER"),
    parts: z.array(z.union([textPartSchema, dataPartSchema])).min(1).max(20),
    contextId: z.string().min(1).max(200).optional(),
    taskId: z.string().min(1).max(200).optional(),
  }).passthrough(),
  configuration: z.object({
    acceptedOutputModes: z.array(z.string()).max(20).optional(),
    returnImmediately: z.boolean().optional(),
  }).passthrough().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type A2ASendMessageRequest = z.infer<typeof a2aSendMessageRequestSchema>;

export interface A2AAgentCard {
  name: string;
  description: string;
  supportedInterfaces: Array<{
    url: string;
    protocolBinding: "HTTP+JSON";
    protocolVersion: typeof A2A_PROTOCOL_VERSION;
  }>;
  version: string;
  capabilities: {
    streaming: false;
    pushNotifications: false;
    stateTransitionHistory: false;
  };
  defaultInputModes: ["text/plain"];
  defaultOutputModes: ["text/plain", "application/json"];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples: string[];
    inputModes: ["text/plain"];
    outputModes: ["text/plain", "application/json"];
  }>;
}

export interface A2AMessageResponse {
  message: {
    messageId: string;
    contextId: string;
    role: "ROLE_AGENT";
    parts: Array<{ text: string } | { data: Record<string, unknown> }>;
  };
}
