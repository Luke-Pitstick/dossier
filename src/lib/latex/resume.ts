import type { PaperSize } from "@/generated/prisma/enums";
import { citationSpans } from "@/lib/citation";
import { documentLabels } from "@/lib/document-labels";
import { documentLanguage } from "@/lib/document-language";
import { formatMonthYear, type ProfileData } from "@/lib/profile";
import { resumeContent, type ResumeOptions } from "@/lib/resume-content";
import type { ResumePresentation } from "@/lib/resume-presentation";

const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "%": "\\%", "$": "\\$", "&": "\\&",
  "_": "\\_", "#": "\\#", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
};
export const escapeTex = (text: string): string => text.replace(/[\\{}%$&#_^~]/g, (char) => ESCAPES[char]).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");

// XeTeX handles shaping; these explicit script runs select bundled fonts.
const SCRIPT_RUN = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Greek}\p{Script=Cyrillic}]+/gu;
export function texText(text: string, rtl = false): string {
  const escaped = escapeTex(text);
  const rendered = escaped.replace(SCRIPT_RUN, (run) => {
    const font = /\p{Script=Arabic}/u.test(run) ? "Arabic" : /\p{Script=Hebrew}/u.test(run) ? "Hebrew" :
      /\p{Script=Devanagari}/u.test(run) ? "Hindi" : /[\p{Script=Greek}\p{Script=Cyrillic}]/u.test(run) ? "Serif" : "Cjk";
    return font === "Arabic" || font === "Hebrew" ? `\\RL{{\\${font}Font ${run}}}` : `{\\${font}Font ${run}}`;
  });
  return rtl && !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text) ? `\\LR{${rendered}}` : rendered;
}
export function inlineTex(text: string, rtl = false): string {
  const rendered = citationSpans(text).map((span) => {
    let value = texText(span.text);
    if (span.italic) value = `\\emph{${value}}`;
    if (span.bold) value = `\\textbf{${value}}`;
    return value;
  }).join("");
  return rtl && !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text) ? `\\LR{${rendered}}` : rendered;
}

export function texLink(target: string, label: string, rtl = false): string {
  const raw = target.trim();
  if (!raw || /[\s\x00-\x1f\\{}]/.test(raw)) return texText(label, rtl);
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!["https:", "http:", "mailto:"].includes(url.protocol)) return texText(label, rtl);
    return `\\href{${escapeTex(url.href)}}{\\underline{${texText(label, rtl)}}}`;
  } catch { return texText(label, rtl); }
}

export type LatexResumeInput = {
  profile: ProfileData; presentation: ResumePresentation; paper: PaperSize;
  language?: string | null; options?: ResumeOptions;
};

export function resumeLatex(template: string, { profile, presentation, paper, language, options }: LatexResumeInput): { tex: string; photo: string | null } {
  const labels = documentLabels(language);
  const c = resumeContent(profile, options, labels);
  const { lang, dir } = documentLanguage(language, JSON.stringify(c));
  const text = (value: string) => texText(value, dir === "rtl");
  const inline = (value: string) => inlineTex(value, dir === "rtl");
  const link = (target: string, label: string) => texLink(target, label, dir === "rtl");
  const english = (lang ?? "en").startsWith("en");
  const section = (title: string, body: string) => body ? `\\section{${text(title)}}\n${body}\n` : "";
  const list = (entries: string[]) => entries.length ? `\\resumeSubHeadingListStart\n${entries.join("\n")}\n\\resumeSubHeadingListEnd` : "";
  const bullets = (items: string[]) => items.length ? `\\resumeItemListStart\n${items.map((item) => `\\resumeItem{${inline(item)}}`).join("\n")}\n\\resumeItemListEnd` : "";
  const subheading = (a: string, b: string, d: string, e: string) => `\\resumeSubheading{${inline(a)}}{${text(b)}}{${inline(d)}}{${text(e)}}`;
  const roles = (leadership: boolean) => list(c.experience.filter((entry) => presentation.leadership.includes(entry.id) === leadership).map((entry) =>
    subheading(entry.role, entry.dates, entry.company, profile.experience.find(({ id }) => id === entry.id)?.location ?? "") + "\n" + bullets(entry.bullets)));
  const education = list(c.education.map((entry) => {
    const meta = presentation.education[entry.id];
    const data = profile.education.find(({ id }) => id === entry.id)!;
    const dates = meta?.expected && data.endYear ? `${english ? "Expected" : ""} ${formatMonthYear(data.endYear, data.endMonth, { locale: labels.locale })}`.trim() : entry.dates;
    return subheading(entry.school, dates, entry.degree, meta?.location ?? "") + "\n" + (entry.notes ? bullets(entry.notes.split("\n").filter(Boolean)) : "");
  }));
  const projects = list(c.projects.map((entry) => {
    const original = profile.projects.find(({ id }) => id === entry.id)!;
    const title = [`\\textbf{${text(entry.name)}}`, entry.skills.length ? `\\emph{${text(entry.skills.join(", "))}}` : "",
      original.link ? link(original.link, /github\.com/i.test(original.link) ? "GitHub" : "Demo") : ""].filter(Boolean).join(" $|$ ");
    return `\\resumeProjectHeading{${title}}{${text(entry.dates)}}\n${bullets(entry.bullets)}`;
  }));
  const remaining = c.skills.split("·").map((item) => item.trim()).filter(Boolean);
  const groups: string[] = [];
  for (const group of presentation.skillGroups) {
    const selected = group.skillIds.flatMap((id) => {
      const name = profile.skills.find((skill) => skill.id === id)?.name;
      const index = remaining.findIndex((item) => citationSpans(item).map((span) => span.text).join("").toLocaleLowerCase() === name?.toLocaleLowerCase());
      return index < 0 ? [] : remaining.splice(index, 1);
    });
    if (selected.length) groups.push(`\\textbf{${text(group.name)}}: ${inline(selected.join(", "))}`);
  }
  if (remaining.length) groups.push(`${groups.length ? `\\textbf{${english ? "Additional skills" : text(labels.skills)}}: ` : ""}${inline(remaining.join(", "))}`);
  const skills = groups.length ? `\\begin{itemize}[leftmargin=0.15in,label={}]\n\\small{\\item{${groups.join(" \\\\\n")}}}\n\\end{itemize}` : "";
  const b = profile.basics;
  const contact = [b.phone ? text(b.phone) : "", b.email ? link(`mailto:${b.email}`, b.email) : "",
    b.website ? link(b.website, b.website.replace(/^https?:\/\//, "").replace(/\/$/, "")) : "",
    b.linkedin ? link(b.linkedin, "LinkedIn") : "", presentation.github ? link(presentation.github, "GitHub") : "",
    ...c.contacts.filter((item) => ![b.phone, b.email, b.website, b.linkedin].includes(item)).map((value) => text(value))].filter(Boolean);
  const header = `\\begin{center}\n${c.photo ? "\\includegraphics[width=1.5cm,height=2cm,keepaspectratio]{photo.png}\\\\\n" : ""}\\textbf{\\Huge ${text(c.name)}} \\\\ \\vspace{1pt}\n${c.headline ? `${inline(c.headline)}\\\\\n` : ""}\\small ${contact.join(" $|$ ")}\n\\end{center}\n`;
  const body = header + section(labels.profile, inline(c.summary)) + section(labels.education, education) +
    section(english ? "Professional Experience" : labels.experience, roles(false)) + section(labels.projects, projects) +
    section(english ? "Leadership Experience" : labels.experience, roles(true)) + section(english ? "Technical Skills" : labels.skills, skills) +
    section(labels.publications, list(c.publications.map((entry) => `\\item ${inline(entry.citation)}${entry.href ? ` ${link(entry.href, entry.link)}` : ""}`))) +
    section(labels.languages, inline(c.languages)) + section(labels.references, list(c.references.map((entry) => `\\item \\textbf{${text(entry.name)}} ${text(entry.role)}\\\\${text(entry.contact)}`)));
  // Fonts are local image assets; nothing is fetched while rendering.
  const multilingual = dir === "rtl" || /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Greek}\p{Script=Cyrillic}]/u.test(body);
  const fonts: Record<string, string> = {
    Serif: String.raw`\newfontfamily\SerifFont{Noto Serif}`,
    Arabic: String.raw`\newfontfamily\ArabicFont{Noto Naskh Arabic}[Script=Arabic]`,
    Hebrew: String.raw`\newfontfamily\HebrewFont{Noto Serif Hebrew}[Script=Hebrew]`,
    Hindi: String.raw`\newfontfamily\HindiFont{Noto Serif Devanagari}[Script=Devanagari]`,
    Cjk: String.raw`\newfontfamily\CjkFont{Noto Serif CJK ${(lang ?? "en").startsWith("ja") ? "JP" : (lang ?? "en").startsWith("ko") ? "KR" : "SC"}}`,
  };
  const fontSetup = multilingual ? [String.raw`\usepackage{fontspec}`,
    ...Object.entries(fonts).filter(([name]) => body.includes(`\\${name}Font`)).map(([, declaration]) => declaration),
    String.raw`\usepackage{bidi}`].join("\n") : "";
  return { tex: template.replace("%%PAPER%%", paper === "LETTER" ? "letterpaper" : "a4paper")
    .replace("%%LANGUAGE%%", fontSetup).replace("%%BODY%%", `${dir === "rtl" ? "\\setRTL\n" : ""}${body}`), photo: c.photo };
}
