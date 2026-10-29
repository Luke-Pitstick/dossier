import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { connectFakeGoogle, fakeGoogle, resetData, sql } from "./support";

// Real compiler and production browser, isolated DB and fake external services.
test.setTimeout(180_000);
let applicationId = "";
async function preview(page: Page) {
  const region = page.getByRole("region", { name: "Compiled LaTeX resume" });
  await expect(region.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await expect(region.getByRole("status")).toHaveText(/^\d+ pages?( ·.*)?$/, { timeout: 60_000 });
}
const isLatex = (pdf: Uint8Array) => expect(Buffer.from(pdf).toString("latin1")).toContain("xdvipdfmx");
test.beforeAll(async () => {
  await resetData();
  await sql(`INSERT INTO "Setting" (key, value, "updatedAt") VALUES ('resumeRenderer','latex',now()), ('paper','LETTER',now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`);
  [{ id: applicationId }] = await sql<{ id: string }>(`SELECT id FROM "Application" WHERE company='Ledgerly' LIMIT 1`);
});

test("base preview, template details and download use actual LaTeX", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/resume");
  await preview(page);
  await page.getByLabel("GitHub profile").fill("https://github.com/example");
  await page.getByRole("button", { name: "Save template details" }).click();
  await preview(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  isLatex(await readFile((await download.path())!));
  await page.reload();
  await expect(page.getByLabel("GitHub profile")).toHaveValue("https://github.com/example");
  expect(errors).toEqual([]);
});

test("generation, manual edits, AI refinement, undo and restored history stay editable", async ({ page }) => {
  await page.goto("/new?fresh=1");
  await page.getByLabel("Job posting").fill("Ledgerly: Senior Product Designer, Payments\n- Strong prototyping skills in Figma\n- 5+ years of product design");
  await page.getByRole("button", { name: "Read the posting →" }).click();
  await expect(page.getByRole("heading", { name: "How you match" })).toBeVisible();
  await page.getByRole("button", { name: "Create application →" }).click();
  await page.waitForURL(/\/applications\/c/, { timeout: 90_000 });
  await preview(page);
  const summary = page.locator('[data-unit="summary"]');
  await summary.hover();
  await summary.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Edit Summary" }).fill("Built **accessible** product systems & prototypes.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(summary).toContainText("Built accessible product systems & prototypes.");
  await page.getByRole("textbox", { name: "Ask for a change" }).fill("Make the summary shorter");
  await page.getByRole("textbox", { name: "Ask for a change" }).press("Enter");
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText("Done. I made the summary shorter.")).toBeVisible();
  await log.getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Built accessible product systems & prototypes.");
  await summary.hover();
  await summary.getByRole("button", { name: "Regenerate" }).click();
  await expect(summary).toContainText("In short:");
  await page.getByRole("button", { name: "History" }).first().click();
  const history = page.getByRole("dialog", { name: "History of the resume" });
  await history.getByRole("list", { name: "Versions" }).getByRole("listitem").last().getByRole("button", { name: /^Look at the version from/ }).click();
  await preview(page);
  await page.getByRole("button", { name: "Restore this version" }).click();
  await expect(page.getByText(/^Restored the resume as it was then\./)).toBeVisible();
  await preview(page);
  const id = page.url().split("/").pop()!;
  const response = await page.request.get(`/api/pdf?doc=resume&application=${id}`);
  expect(response.ok()).toBe(true);
  isLatex(await response.body());
});

test("bulk ZIP contains LaTeX resumes and regular cover letters", async ({ page }) => {
  await page.goto("/settings?section=data");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 150_000 }), page.getByRole("button", { name: "Download", exact: true }).click()]);
  const files = unzipSync(await readFile((await download.path())!));
  const resumes = Object.entries(files).filter(([name]) => name.endsWith("Resume.pdf"));
  expect(resumes.length).toBeGreaterThan(0);
  resumes.forEach(([, bytes]) => isLatex(bytes));
  expect(Object.keys(files).some((name) => name.endsWith("Cover letter.pdf"))).toBe(true);
});

test("Gmail uses LaTeX attachment bytes without contacting real Google", async ({ page }) => {
  await sql(`UPDATE "Application" SET "postingText"="postingText" || $2 WHERE id=$1`, [applicationId, "\nSend your application to John Doe, careers@example.com."]);
  await connectFakeGoogle(page);
  await page.goto(`/applications/${applicationId}?tab=email`);
  await page.getByRole("button", { name: "Write the email" }).click();
  await page.getByRole("button", { name: "Send with Gmail" }).click();
  await page.getByRole("alertdialog", { name: "Send this application?" }).getByRole("button", { name: "Send now" }).click();
  await expect(page.getByRole("button", { name: "Send again with Gmail" })).toBeVisible({ timeout: 60_000 });
  const sent = (await fakeGoogle()).sent.at(-1)!;
  expect(sent.attachments).toEqual([expect.stringMatching(/Resume\.pdf$/), expect.stringMatching(/Cover letter\.pdf$/)]);
  const parts = sent.raw.split(/--dossier[^\r\n]*/);
  const resume = parts.find((part) => /filename=.*Resume\.pdf/.test(part));
  expect(resume).toBeDefined();
  isLatex(Buffer.from(resume!.split(/\r?\n\r?\n/).slice(1).join("").replace(/\s/g, ""), "base64"));
});
