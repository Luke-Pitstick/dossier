"use server";

import { revalidatePath } from "next/cache";
import { action, ActionError } from "@/lib/action";
import { loadProfile } from "@/lib/profile-data";
import { prisma } from "@/lib/prisma";
import { PRESENTATION_KEY, presentationSchema } from "@/lib/resume-presentation";

export const saveResumePresentation = action(presentationSchema, async (value) => {
  const profile = await loadProfile();
  const exists = (ids: string[], entries: { id: string }[]) => ids.every((id) => entries.some((entry) => entry.id === id));
  const skills = value.skillGroups.flatMap((group) => group.skillIds);
  if (!exists(value.leadership, profile.experience) || !exists(skills, profile.skills) ||
      !exists(Object.keys(value.education), profile.education) || new Set(skills).size !== skills.length) {
    throw new ActionError("Choose existing entries, and assign each skill to only one group.");
  }
  const data = JSON.stringify(value);
  await prisma.profileField.upsert({ where: { key: PRESENTATION_KEY }, create: { key: PRESENTATION_KEY, value: data }, update: { value: data } });
  revalidatePath("/resume");
  return value;
});
