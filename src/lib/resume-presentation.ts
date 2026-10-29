import { z } from "zod";

export const PRESENTATION_KEY = "resumePresentation";
const id = z.string().min(1).max(100);
export const presentationSchema = z.object({
  github: z.string().max(500).default(""),
  leadership: z.array(id).max(100).default([]),
  skillGroups: z.array(z.object({ name: z.string().trim().min(1).max(80), skillIds: z.array(id).max(300) })).max(20).default([]),
  education: z.record(id, z.object({ location: z.string().max(200), expected: z.boolean() })).default({}),
});
export type ResumePresentation = z.infer<typeof presentationSchema>;
export const EMPTY_PRESENTATION = presentationSchema.parse({});

export function readPresentation(value?: string): ResumePresentation {
  if (!value) return presentationSchema.parse({});
  // Bad imported metadata must be reported, not silently discarded.
  return presentationSchema.parse(JSON.parse(value));
}
