import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractText } from "unpdf";
import sharp from "sharp";
import { demoProfile, demoResumeUnits } from "@/lib/demo-profile";
import { countPdfPages } from "@/lib/pdf/pages";
import { EMPTY_PRESENTATION } from "@/lib/resume-presentation";
import { compileLatex } from "./compile";
import { resumeLatex } from "./resume";

describe.runIf(existsSync("/usr/local/bin/tectonic"))("offline compiler integration", () => {
  it("compiles real base and tailored PDFs with safe text and actual page counts", async () => {
    const template = await readFile("src/lib/latex/luke-resume.tex", "utf8");
    const profile = demoProfile();
    profile.basics.summary = "Built **Python & SQL** tools. 75% accuracy. Literal \\input{/etc/passwd}.";
    const rendered = resumeLatex(template, { profile, presentation: EMPTY_PRESENTATION, paper: "LETTER" });
    const pdf = await compileLatex(rendered.tex);
    expect(await countPdfPages(pdf)).toBeGreaterThan(0);
    const text = (await extractText(new Uint8Array(pdf), { mergePages: true })).text;
    expect(text).toContain("Python & SQL");
    expect(text).toContain("75%");
    expect(text).not.toContain("root:x:");
    if (existsSync("/verification")) await writeFile("/verification/generated-demo.pdf", pdf);
    const units = demoResumeUnits().filter((unit) => unit.id !== "experience:e3");
    const tailored = resumeLatex(template, { profile, presentation: EMPTY_PRESENTATION, paper: "A4", options: { units, includeReferences: true } });
    const result = (await extractText(await compileLatex(tailored.tex), { mergePages: true })).text;
    expect(result).not.toContain("Studio Brik");
    expect(result).toContain("References");
  }, 120_000);

  it("renders mixed scripts, RTL and a validated WebP photo", async () => {
    const template = await readFile("src/lib/latex/luke-resume.tex", "utf8");
    const profile = demoProfile();
    const webp = await sharp({ create: { width: 48, height: 64, channels: 3, background: "#5588aa" } }).webp().toBuffer();
    profile.photo = { src: `data:image/webp;base64,${webp.toString("base64")}`, onResumes: true };
    profile.basics.name = "ليلى";
    profile.basics.summary = "العربية فارسی עברית हिन्दी 中文 日本語 한국어 Ελληνικά Русский";
    const rendered = resumeLatex(template, { profile, presentation: EMPTY_PRESENTATION, paper: "A4", language: "Arabic" });
    const pdf = await compileLatex(rendered.tex, rendered.photo);
    expect(await countPdfPages(pdf)).toBeGreaterThan(0);
    if (existsSync("/verification")) await writeFile("/verification/generated-multilingual.pdf", pdf);
  }, 120_000);

  it("reports compilation errors and releases the queue after cancellation", async () => {
    await expect(compileLatex("\\documentclass{article}\\begin{document}\\unknowncommand\\end{document}")).rejects.toThrow("could not be compiled");
    const controller = new AbortController();
    controller.abort(new Error("Cancelled"));
    await expect(compileLatex("ignored", null, controller.signal)).rejects.toThrow("Cancelled");
    const pdf = await compileLatex("\\documentclass{article}\\begin{document}Still works.\\end{document}");
    expect(await countPdfPages(pdf)).toBe(1);
  }, 120_000);
});
