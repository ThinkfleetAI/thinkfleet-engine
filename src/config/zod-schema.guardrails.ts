import { z } from "zod";

const ToolGuardrailActionSchema = z.union([
  z.literal("allow"),
  z.literal("ask"),
  z.literal("deny"),
]);

const ToolGuardrailRuleSchema = z
  .object({
    match: z.string().min(1),
    action: ToolGuardrailActionSchema,
  })
  .strict();

const ToolGuardrailAuditSchema = z.union([
  z.boolean(),
  z
    .object({
      enabled: z.boolean().optional(),
      scope: z.union([z.literal("per-agent"), z.literal("global")]).optional(),
    })
    .strict(),
]);

export const ToolGuardrailsSchema = z
  .object({
    enabled: z.boolean().optional(),
    defaultAction: ToolGuardrailActionSchema.optional(),
    rules: z.array(ToolGuardrailRuleSchema).optional(),
    askTimeoutMs: z.number().int().positive().optional(),
    audit: ToolGuardrailAuditSchema.optional(),
    stats: z.boolean().optional(),
  })
  .strict()
  .optional();
