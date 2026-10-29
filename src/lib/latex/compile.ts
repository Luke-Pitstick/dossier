import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { isPhotoDataUrl } from "@/lib/photo";

const execute = promisify(execFile);
// One compiler at a time: preview, page fitting and bulk export share the queue.
let tail: Promise<unknown> = Promise.resolve();

export class LatexError extends Error {
  constructor() { super("The LaTeX PDF could not be compiled. Check the resume text and installed fonts, then try again."); }
}

export async function compileLatex(tex: string, photo: string | null = null, signal?: AbortSignal): Promise<Uint8Array> {
  if (Buffer.byteLength(tex) > 1_000_000) throw new LatexError();
  const run = tail.then(async () => {
    signal?.throwIfAborted();
    const directory = await mkdtemp(path.join(tmpdir(), "dossier-tex-"));
    try {
      await writeFile(path.join(directory, "resume.tex"), tex);
      if (photo) {
        if (!isPhotoDataUrl(photo)) throw new LatexError();
        await sharp(Buffer.from(photo.split(",")[1], "base64"), { limitInputPixels: 4_000_000 })
          .rotate().resize({ width: 480, height: 640, fit: "inside", withoutEnlargement: true })
          .png().toFile(path.join(directory, "photo.png"));
      }
      await execute("/usr/local/bin/tectonic", ["--untrusted", "--only-cached", "--keep-logs", "resume.tex"], {
        cwd: directory, timeout: 45_000, maxBuffer: 256_000, signal,
        env: { NODE_ENV: "production", PATH: "/usr/local/bin:/usr/bin:/bin", HOME: directory, XDG_CACHE_HOME: "/opt/tectonic-cache", TECTONIC_UNTRUSTED_MODE: "1" },
      });
      const log = await readFile(path.join(directory, "resume.log"), "utf8");
      if (/Missing character:/.test(log)) throw new LatexError();
      const pdf = await readFile(path.join(directory, "resume.pdf"));
      if (pdf.subarray(0, 5).toString() !== "%PDF-" || pdf.length > 10_000_000) throw new LatexError();
      return new Uint8Array(pdf);
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      // Compiler logs contain private resume text: don't expose or log them.
      if (error instanceof LatexError) throw error;
      throw new LatexError();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  tail = run.catch(() => undefined);
  return run;
}
