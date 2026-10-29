import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentKind } from "@/generated/prisma/enums";
import { extractedSchema, unitsSchema, type Unit } from "@/lib/application-data";
import { compileLatex } from "@/lib/latex/compile";
import { resumeLatex } from "@/lib/latex/resume";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile-data";
import { loadResumePresentation } from "@/lib/resume-presentation-data";
import { loadSettings } from "@/lib/settings-data";
import { renderPdf } from "./render";

export type PdfDocument = { kind: "base" } | { kind: "resume" | "letter"; applicationId: string };
export type ResumePreview = { units?: Unit[]; showPhoto?: boolean | null };

/** Every delivery path uses this service. Preview overrides are never persisted. */
export async function renderDocumentPdf(document: PdfDocument, preview?: ResumePreview, signal?: AbortSignal): Promise<Uint8Array> {
  signal?.throwIfAborted();
  const settings = await loadSettings();
  if (document.kind === "letter" || settings.resumeRenderer === "html") {
    if (preview) throw new Error("Transient PDF previews require the LaTeX format.");
    return renderPdf(document.kind === "base" ? "/print/base" : `/print/${document.kind}/${document.applicationId}`);
  }
  const [profile, template] = await Promise.all([
    loadProfile(), readFile(path.join(process.cwd(), "src/lib/latex/luke-resume.tex"), "utf8"),
  ]);
  const presentation = await loadResumePresentation(profile);
  let options = { includeReferences: settings.includeRefs } as import("@/lib/resume-content").ResumeOptions;
  let language = settings.resumeLanguage;
  if (document.kind === "resume") {
    // Deliberately fresh: page fitting mutates units between compilations.
    const application = await prisma.application.findUnique({ where: { id: document.applicationId },
      include: { documents: { where: { kind: DocumentKind.RESUME }, select: { units: true } } } });
    if (!application?.documents[0]) throw new Error("This application has no tailored resume.");
    const extracted = extractedSchema.safeParse(application.extracted);
    language = application.language;
    options = { units: preview?.units ?? unitsSchema.parse(application.documents[0].units),
      showPhoto: preview?.showPhoto === undefined ? application.showPhoto : preview.showPhoto,
      includeReferences: settings.includeRefs && extracted.success && extracted.data.asksForReferences === true };
  }
  const result = resumeLatex(template, { profile, presentation, paper: settings.paper, language, options });
  return compileLatex(result.tex, result.photo, signal);
}
