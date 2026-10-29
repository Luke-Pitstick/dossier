"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfileData } from "@/lib/profile";
import type { ResumePresentation } from "@/lib/resume-presentation";
import { saveResumePresentation } from "./latex-actions";

export function LatexWorkspace({ profile, presentation, maxPages, revision: profileRevision }: { profile: ProfileData; presentation: ResumePresentation; maxPages: number | null; revision: string }) {
  const [value, setValue] = useState(presentation);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const result = toastResult(await saveResumePresentation(value));
    setSaving(false);
    if (result.ok) setRevision((n) => n + 1);
  };
  return <>
    <PageHeader title="Base resume" description="Your profile, typeset with Luke’s LaTeX template." actions={<><Link href="/profile" className="underline">Edit profile</Link><DownloadPdfButton href="/api/pdf?doc=base">Download PDF</DownloadPdfButton></>} />
    <div className="flex flex-1 flex-wrap items-start overflow-auto border-t border-line">
      <div className="min-w-0 flex-[3_1_550px]"><PdfPreview document={{ kind: "base" }} revision={`${profileRevision}:${revision}`} maxPages={maxPages} /></div>
      <aside className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5 p-6">
        <h2 className="font-semibold">Template details</h2>
        <p className="text-meta text-muted">Text and emphasis come from your profile. Use **bold** and *italic* inside bullets. Paper, language, references and resume format are in <Link className="underline" href="/settings?section=documents">Documents settings</Link>.</p>
        <Input label="GitHub profile" value={value.github} onChange={(e) => setValue({ ...value, github: e.target.value })} />
        <fieldset className="flex flex-col gap-2"><legend className="mb-2 font-medium">Leadership experience</legend>{profile.experience.map((entry) => <label key={entry.id} className="flex gap-2 text-meta"><input type="checkbox" checked={value.leadership.includes(entry.id)} onChange={(e) => setValue({ ...value, leadership: e.target.checked ? [...value.leadership, entry.id] : value.leadership.filter((id) => id !== entry.id) })} />{entry.role} · {entry.company}</label>)}</fieldset>
        {profile.education.map((entry) => <fieldset key={entry.id} className="flex flex-col gap-2"><legend>{entry.school}</legend>
          <Input label="Education location" value={value.education[entry.id]?.location ?? ""} onChange={(e) => setValue({ ...value, education: { ...value.education, [entry.id]: { expected: value.education[entry.id]?.expected ?? false, location: e.target.value } } })} />
          <label className="flex gap-2 text-meta"><input type="checkbox" checked={value.education[entry.id]?.expected ?? false} onChange={(e) => setValue({ ...value, education: { ...value.education, [entry.id]: { location: value.education[entry.id]?.location ?? "", expected: e.target.checked } } })} />Expected graduation (uses the education end date)</label>
        </fieldset>)}
        <div className="flex flex-col gap-3"><h3 className="font-medium">Skill groups</h3>
          {value.skillGroups.map((group, index) => <fieldset key={index} className="flex flex-col gap-2 rounded border border-line p-3">
            <Input label="Group name" value={group.name} onChange={(e) => setValue({ ...value, skillGroups: value.skillGroups.map((g, i) => i === index ? { ...g, name: e.target.value } : g) })} />
            {profile.skills.map((skill) => <label key={skill.id} className="flex gap-2 text-meta"><input type="checkbox" checked={group.skillIds.includes(skill.id)} disabled={!group.skillIds.includes(skill.id) && value.skillGroups.some((g) => g.skillIds.includes(skill.id))} onChange={(e) => setValue({ ...value, skillGroups: value.skillGroups.map((g, i) => i === index ? { ...g, skillIds: e.target.checked ? [...g.skillIds, skill.id] : g.skillIds.filter((id) => id !== skill.id) } : g) })} />{skill.name}</label>)}
            <button className="text-left text-meta underline" onClick={() => setValue({ ...value, skillGroups: value.skillGroups.filter((_, i) => i !== index) })}>Remove group</button>
          </fieldset>)}
          <Button variant="secondary" onClick={() => setValue({ ...value, skillGroups: [...value.skillGroups, { name: "New group", skillIds: [] }] })}>Add skill group</Button>
        </div>
        <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save template details"}</Button>
      </aside>
    </div>
  </>;
}
