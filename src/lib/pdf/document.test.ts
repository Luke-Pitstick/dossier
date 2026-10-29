import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoProfile, demoResumeUnits } from "@/lib/demo-profile";
import { settingsFromRows } from "@/lib/settings";
import { EMPTY_PRESENTATION } from "@/lib/resume-presentation";
import { renderDocumentPdf } from "./document";

const fake = vi.hoisted(() => ({ settings: vi.fn(), app: vi.fn(), compile: vi.fn(), html: vi.fn() }));
vi.mock("@/lib/settings-data", () => ({ loadSettings: fake.settings }));
vi.mock("@/lib/profile-data", () => ({ loadProfile: async () => demoProfile() }));
vi.mock("@/lib/resume-presentation-data", () => ({ loadResumePresentation: async () => EMPTY_PRESENTATION }));
vi.mock("@/lib/prisma", () => ({ prisma: { application: { findUnique: fake.app } } }));
vi.mock("@/lib/latex/compile", () => ({ compileLatex: fake.compile }));
vi.mock("./render", () => ({ renderPdf: fake.html }));

beforeEach(() => {
  vi.clearAllMocks();
  fake.settings.mockResolvedValue({ ...settingsFromRows([]), resumeRenderer: "latex" });
  fake.compile.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  fake.app.mockResolvedValue({ language: "English", showPhoto: null, extracted: {}, documents: [{ units: demoResumeUnits() }] });
});
describe("shared document renderer", () => {
  it("uses LaTeX for both resume types and Chromium for letters", async () => {
    await renderDocumentPdf({ kind: "base" });
    await renderDocumentPdf({ kind: "resume", applicationId: "a1" });
    expect(fake.compile).toHaveBeenCalledTimes(2);
    await renderDocumentPdf({ kind: "letter", applicationId: "a1" });
    expect(fake.html).toHaveBeenCalledWith("/print/letter/a1");
  });
  it("reads changed units afresh for every page-fitting render", async () => {
    await renderDocumentPdf({ kind: "resume", applicationId: "a1" });
    fake.app.mockResolvedValue({ language: "English", showPhoto: null, extracted: {}, documents: [{ units: [{ id: "summary", label: "Summary", text: "Changed after trimming" }] }] });
    await renderDocumentPdf({ kind: "resume", applicationId: "a1" });
    expect(fake.compile.mock.calls[1][0]).toContain("Changed after trimming");
    expect(fake.compile.mock.calls[1][0]).not.toContain("Northwind");
  });
  it("never falls back to HTML after a compiler failure", async () => {
    fake.compile.mockRejectedValue(new Error("compile failed"));
    await expect(renderDocumentPdf({ kind: "base" })).rejects.toThrow("compile failed");
    expect(fake.html).not.toHaveBeenCalled();
  });
  it("uses explicit HTML selection and accepts transient preview units only for LaTeX", async () => {
    await renderDocumentPdf({ kind: "resume", applicationId: "a1" }, { units: [{ id: "summary", label: "Summary", text: "Unsaved preview" }] });
    expect(fake.compile.mock.calls[0][0]).toContain("Unsaved preview");
    fake.settings.mockResolvedValue(settingsFromRows([]));
    await renderDocumentPdf({ kind: "base" });
    expect(fake.html).toHaveBeenCalledWith("/print/base");
  });
});
