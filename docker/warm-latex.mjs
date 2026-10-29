import { readFileSync, writeFileSync } from "node:fs";
const preamble = String.raw`\usepackage{fontspec}
\newfontfamily\ArabicFont{Noto Naskh Arabic}[Script=Arabic]
\newfontfamily\HebrewFont{Noto Serif Hebrew}[Script=Hebrew]
\newfontfamily\HindiFont{Noto Serif Devanagari}[Script=Devanagari]
\newfontfamily\SerifFont{Noto Serif}
\newfontfamily\CjkFont{Noto Serif CJK SC}
\newfontfamily\JapaneseFont{Noto Serif CJK JP}
\newfontfamily\KoreanFont{Noto Serif CJK KR}
\usepackage{bidi}`;
const body = String.raw`\begin{center}\textbf{\Huge Example Resume}\end{center}
\section{Education}\resumeSubHeadingListStart
\resumeSubheading{University}{2026}{Degree}{Location}
\resumeItemListStart\resumeItem{\textbf{Bold} and \emph{italic}, résumé, 75\%, \$36M, \href{https://example.com}{link}.}\resumeItem{Second bullet.}\resumeItemListEnd
\resumeProjectHeading{Project $|$ Stack}{2026}\resumeItemListStart\resumeItem{Example.}\resumeItemListEnd
\resumeSubHeadingListEnd
{\SerifFont Ελληνικά Русский}
\RL{{\ArabicFont العربية فارسی}} \RL{{\HebrewFont עברית}}
{\HindiFont हिन्दी} {\CjkFont 中文} {\JapaneseFont 日本語} {\KoreanFont 한국어}`;
const template = readFileSync("/app/src/lib/latex/luke-resume.tex", "utf8");
writeFileSync("/tmp/warm.tex", template.replace("%%PAPER%%", "letterpaper").replace("%%LANGUAGE%%", preamble).replace("%%BODY%%", body));
writeFileSync("/tmp/latin.tex", template.replace("%%PAPER%%", "a4paper").replace("%%LANGUAGE%%", "").replace("%%BODY%%", body.split("{\\SerifFont")[0]));
