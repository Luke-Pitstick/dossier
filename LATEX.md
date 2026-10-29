# LaTeX resumes

Select **Settings → Documents → Resume format → Luke’s LaTeX**. The base resume
page shows the compiled PDF and controls for GitHub, skill groups, leadership
roles and education annotations. Edit profile content in Profile; `**bold**` and
`*italic*` work in resume text. Tailored resumes retain section editing, AI
refinement, undo and version history beside their compiled preview. Downloads
always use the saved current version.

The trusted template in `src/lib/latex/luke-resume.tex` preserves the supplied
Jake Gutierrez template’s typography, margins and macros. Its entry tables wrap
long generated headings. Content is escaped and mapped in `resume.ts`; users
and AI never supply executable TeX. No database migration is required:
`resumeRenderer` is a Setting and `resumePresentation` is a ProfileField. Both
are included in the existing data export/import flow. Presentation IDs refer to
existing profile records; deleted records are filtered out when loading.

`src/lib/pdf/document.ts` is the document-rendering entry point for PDF downloads,
Gmail attachments, bulk ZIP exports and page fitting. Resume requests compile
with Tectonic; cover letters use the existing Chromium renderer. The preview
endpoint also uses this service, with transient editor or history units, without
writing them. The browser paints actual PDF pages with the existing unpdf
library and leaves text access and editing to the adjacent content editor.

The Docker image supports amd64 and arm64 with pinned, checksummed Tectonic
0.17.0 archives. The image build downloads the template’s TeX packages and Noto
fonts. Runtime compilation is offline and untrusted, runs without application
secrets, has bounded input/output and a timeout, and removes temporary files.
One queue bounds concurrent compilation. Unsupported glyphs produce an error
rather than a silently incomplete PDF. Styling comes from the bundled template;
Dossier’s HTML theme choices do not style LaTeX resumes.

Build with `docker build --target production -t dossier-latex .`. On Apple
Silicon use `--platform linux/arm64` and an arm64 Compose app service so Chromium
also runs natively. Keep the existing database and `/data` volumes; recreate
only the app service after taking a database dump and volume backup. No resume
or profile content needs to be replaced to enable this format.

## Verification

Run the regular typecheck, lint and tests. `src/lib/latex/compile.test.ts` runs
real compilation checks when `/usr/local/bin/tectonic` exists; it covers escaped
text, tailored omissions, page counts, mixed scripts, photos and failure
recovery. `e2e/latex.spec.ts` exercises production previews, downloads,
generation, section edits, chat/undo/history, ZIP contents and Gmail attachment
bytes using the repository’s isolated database and fake providers. Follow
DEVELOPMENT.md for the normal end-to-end setup; no real email is sent.

The supplied original one-page source was compiled unchanged with Tectonic and
compared with its pdfLaTeX PDF: all 581 extracted words and line wraps matched,
with small vertical spacing differences (up to approximately 3.5 points).
A base resume includes the full stored profile and may therefore be longer than
the original source. The application’s page-limit setting applies when tailoring;
the base preview reports its actual page count without deleting profile content.
