import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demoProfile, demoResumeUnits } from "@/lib/demo-profile";
import { presentationSchema } from "@/lib/resume-presentation";
import { escapeTex, inlineTex, resumeLatex, texLink } from "./resume";

const template = readFileSync("src/lib/latex/luke-resume.tex", "utf8");
const profile = demoProfile();
const presentation = presentationSchema.parse({ leadership: ["e3"], github: "https://github.com/example" });

describe("LaTeX resume", () => {
  it("escapes commands and preserves only the supported emphasis", () => {
    expect(escapeTex("\\input{/etc/passwd} & 75% $36M #1_a~b^c")).toBe("\\textbackslash{}input\\{/etc/passwd\\} \\& 75\\% \\$36M \\#1\\_a\\textasciitilde{}b\\textasciicircum{}c");
    expect(inlineTex("Built **C++ & SQL** and *Python*.")).toBe("Built \\textbf{C++ \\& SQL} and \\emph{Python}.");
    expect(texLink("javascript:alert(1)", "Link")).toBe("Link");
    expect(texLink("https://example.com/\\input{x}", "Link")).toBe("Link");
    expect(texLink("https://example.com/?a=1&b=2", "Site")).toContain("a=1\\&b=2");
  });
  it("renders profile sections, leadership, references and links", () => {
    const { tex } = resumeLatex(template, { profile, presentation, paper: "LETTER", options: { includeReferences: true } });
    expect(tex).toContain("letterpaper,10pt");
    expect(tex).toContain("\\section{Leadership Experience}");
    expect(tex).toContain("\\section{Projects}");
    expect(tex).toContain("\\section{References}");
    expect(tex).toContain("https://github.com/example");
    expect(tex.indexOf("\\section{Education}")).toBeLessThan(tex.indexOf("\\section{Professional Experience}"));
    expect(tex).not.toContain("%%BODY%%");
  });
  it("never restores omitted units or skills from the profile", () => {
    const units = demoResumeUnits().filter((unit) => unit.id !== "experience:e3" && !unit.id.startsWith("project:"));
    const skill = profile.skills[0];
    const { tex } = resumeLatex(template, { profile, paper: "A4", presentation: presentationSchema.parse({ skillGroups: [{ name: "Tools", skillIds: [skill.id] }] }), options: { units: units.map((unit) => unit.id === "skills" ? { ...unit, text: "Manual skill" } : unit) } });
    expect(tex).not.toContain("Studio Brik");
    expect(tex).not.toContain("\\section{Projects}");
    expect(tex).toContain("Manual skill");
    expect(tex).not.toContain("\\textbf{Tools}");
  });
  it("uses multilingual fonts and direction without admitting TeX input", () => {
    const p = { ...profile, basics: { ...profile.basics, name: "ليلى", summary: "हिन्दी 中文 Ελληνικά" } };
    const { tex } = resumeLatex(template, { profile: p, presentation, paper: "A4", language: "Arabic" });
    expect(tex).toContain("\\setRTL");
    expect(tex).toContain("\\ArabicFont ليلى");
    expect(tex).toContain("\\HindiFont हिन्दी");
    expect(tex).toContain("\\CjkFont 中文");
  });
});
