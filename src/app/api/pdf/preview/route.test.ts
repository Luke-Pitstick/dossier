import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getSession } from "@/lib/auth/session";
import { renderDocumentPdf } from "@/lib/pdf/document";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/pdf/document", () => ({ renderDocumentPdf: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { documentVersion: { findFirst: vi.fn() } } }));
const post = (body: unknown, origin = "http://localhost:3000") => POST(new NextRequest("http://localhost:3000/api/pdf/preview", {
  method: "POST", headers: { origin, host: "localhost:3000" }, body: JSON.stringify(body),
}), undefined);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSession).mockResolvedValue({ persistent: false, issuedAt: new Date(), expiresAt: new Date() });
  vi.mocked(renderDocumentPdf).mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});
it("requires the session and same origin before compiling", async () => {
  expect((await post({ kind: "base" }, "https://other.example")).status).toBe(403);
  vi.mocked(getSession).mockResolvedValue(null);
  expect((await post({ kind: "base" })).status).toBe(401);
  expect(renderDocumentPdf).not.toHaveBeenCalled();
});
it("bounds input and refuses non-resume requests", async () => {
  expect((await post({ kind: "letter", applicationId: "app1" })).status).toBe(400);
  expect((await post({ kind: "base", large: "a".repeat(200_000) })).status).toBe(413);
  expect(renderDocumentPdf).not.toHaveBeenCalled();
});
it("looks up a version within its application and document kind", async () => {
  vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue(null);
  expect((await post({ kind: "resume", applicationId: "app1", versionId: "wrong" })).status).toBe(404);
  expect(prisma.documentVersion.findFirst).toHaveBeenCalledWith({ where: { id: "wrong", document: { applicationId: "app1", kind: "RESUME" } }, select: { units: true } });
  expect(renderDocumentPdf).not.toHaveBeenCalled();
});
it("renders transient changes without persisting them and disables caching", async () => {
  const response = await post({ kind: "resume", applicationId: "app1", units: [{ id: "summary", label: "Summary", text: "Preview only" }] });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(renderDocumentPdf).toHaveBeenCalledWith(expect.objectContaining({ kind: "resume", applicationId: "app1" }), { units: [{ id: "summary", label: "Summary", text: "Preview only" }], showPhoto: undefined }, expect.any(AbortSignal));
});
