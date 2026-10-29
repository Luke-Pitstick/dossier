import { NextResponse } from "next/server";
import { z } from "zod";
import { DocumentKind } from "@/generated/prisma/enums";
import { unitsSchema } from "@/lib/application-data";
import { LatexError } from "@/lib/latex/compile";
import { renderDocumentPdf } from "@/lib/pdf/document";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/route";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("base") }),
  z.object({ kind: z.literal("resume"), applicationId: z.string().regex(/^[a-z0-9]{1,64}$/i),
    units: unitsSchema.optional(), versionId: z.string().max(100).optional(), showPhoto: z.boolean().nullable().optional() }),
]);

export const POST = route(async (request) => {
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "That resume is too large to preview." }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid preview request." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid preview request." }, { status: 400 });
  const data = parsed.data;
  let units = data.kind === "resume" ? data.units : undefined;
  if (data.kind === "resume" && data.versionId) {
    const version = await prisma.documentVersion.findFirst({ where: { id: data.versionId,
      document: { applicationId: data.applicationId, kind: DocumentKind.RESUME } }, select: { units: true } });
    if (!version) return NextResponse.json({ error: "That resume version no longer exists." }, { status: 404 });
    units = unitsSchema.parse(version.units);
  }
  try {
    const pdf = await renderDocumentPdf(data, data.kind === "resume" ? { units, showPhoto: data.showPhoto } : undefined, request.signal);
    return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf" } });
  } catch (error) {
    if (error instanceof LatexError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
});
