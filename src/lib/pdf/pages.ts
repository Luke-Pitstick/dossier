import { getDocumentProxy } from "unpdf";

/** Parse the page tree, including compressed objects emitted by TeX. */
export async function countPdfPages(pdf: Uint8Array): Promise<number> {
  const document = await getDocumentProxy(new Uint8Array(pdf));
  try { return document.numPages; }
  finally { await document.loadingTask.destroy(); }
}
