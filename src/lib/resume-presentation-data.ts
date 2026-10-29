import "server-only";
import { prisma } from "@/lib/prisma";
import { PRESENTATION_KEY, readPresentation } from "@/lib/resume-presentation";
import type { ProfileData } from "@/lib/profile";

export async function loadResumePresentation(profile: ProfileData) {
  const row = await prisma.profileField.findUnique({ where: { key: PRESENTATION_KEY } });
  const value = readPresentation(row?.value);
  return {
    ...value,
    leadership: value.leadership.filter((id) => profile.experience.some((entry) => entry.id === id)),
    skillGroups: value.skillGroups.map((group) => ({ ...group, skillIds: group.skillIds.filter((id) => profile.skills.some((skill) => skill.id === id)) })),
    education: Object.fromEntries(Object.entries(value.education).filter(([id]) => profile.education.some((entry) => entry.id === id))),
  };
}
