"use client";

import { useEffect, useRef, useState } from "react";
import type { Unit } from "@/lib/application-data";

type Request = { kind: "base" } | { kind: "resume"; applicationId: string; units: Unit[]; versionId?: string; showPhoto?: boolean | null };

/** The actual compiled PDF. The adjacent content editor supplies accessible text and editing actions. */
export function PdfPreview({ document, revision = "", maxPages }: { document: Request; revision?: string; maxPages?: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Compiling PDF…");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const body = JSON.stringify(document);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let destroy: (() => Promise<void>) | undefined;
    const timer = setTimeout(async () => {
      setStatus("Compiling PDF…");
      setError(false);
      host.current?.replaceChildren();
      try {
        const response = await fetch("/api/pdf/preview", { method: "POST", headers: { "content-type": "application/json" }, body, signal: controller.signal });
        if (!response.ok) throw new Error((await response.json()).error ?? "Could not render the PDF.");
        const { getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(await response.arrayBuffer()), { disableFontFace: true, useSystemFonts: false });
        destroy = () => pdf.loadingTask.destroy();
        if (disposed) { await destroy(); return; }
        for (let i = 1; i <= pdf.numPages; i++) {
          if (disposed) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = window.document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "mb-5 h-auto w-full bg-white shadow-page";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `Resume PDF, page ${i}. Use the content editor for text.`);
          await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
          if (!disposed) host.current?.appendChild(canvas);
        }
        if (!disposed) setStatus(`${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}${maxPages && pdf.numPages > maxPages ? ` · Over the ${maxPages}-page limit` : ""}`);
      } catch (cause) {
        if (!disposed) { setError(true); setStatus(cause instanceof Error ? cause.message : "Could not render the PDF."); }
      }
    }, 400);
    return () => { disposed = true; clearTimeout(timer); controller.abort(); void destroy?.(); };
  }, [body, revision, retry, maxPages]);
  return <section aria-label="Compiled LaTeX resume" className="w-full bg-canvas p-6">
    <div className="mx-auto max-w-[800px]">
      <div className="mb-4 flex justify-between gap-3 text-meta"><span>Luke’s LaTeX · PDF preview</span><span role={error ? "alert" : "status"}>{status}</span></div>
      {error && <button className="mb-4 underline" onClick={() => setRetry((n) => n + 1)}>Retry preview</button>}
      <div ref={host} />
    </div>
  </section>;
}
