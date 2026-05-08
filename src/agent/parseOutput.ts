import type { AgentOutput, ResumeData } from '../types';

const HEADINGS = {
  resume: /^##\s*OUTPUT\s*1\s*:\s*OPTIMIZED\s*RESUME.*$/im,
  coverLetter: /^##\s*OUTPUT\s*2\s*:\s*COVER\s*LETTER.*$/im,
  interview: /^##\s*OUTPUT\s*3\s*:\s*INTERVIEW\s*PREPARATION.*$/im,
} as const;

/**
 * Matches a fenced JSON block, with or without the "RESUME" tag.
 *   ```json RESUME
 *   {...}
 *   ```
 * or
 *   ```json
 *   {...}
 *   ```
 */
const RESUME_JSON_FENCE = /```json(?:\s+RESUME)?\s*\n([\s\S]*?)```/i;

/**
 * Splits the raw model response into the three required sections, plus
 * a structured `resumeData` object if the model included a fenced JSON block.
 *
 * The parser is intentionally lenient about whitespace/case but strict about
 * section order (resume → cover letter → interview).
 */
export function parseAgentOutput(raw: string): AgentOutput {
  const normalized = raw.replace(/\r\n/g, '\n').trim();

  const resumeMatch = normalized.match(HEADINGS.resume);
  const coverMatch = normalized.match(HEADINGS.coverLetter);
  const interviewMatch = normalized.match(HEADINGS.interview);

  if (!resumeMatch || resumeMatch.index === undefined) {
    return {
      optimizedResume: normalized,
      coverLetter: '',
      interviewPrep: '',
      raw,
    };
  }

  const resumeStart = resumeMatch.index + resumeMatch[0].length;
  const coverStart =
    coverMatch && coverMatch.index !== undefined
      ? coverMatch.index
      : (interviewMatch?.index ?? normalized.length);

  const resumeBlock = normalized.slice(resumeStart, coverStart).trim();

  // Pull the JSON block out of the resume section (if present) and remove it
  // from the human-readable plain text so the user doesn't see raw JSON.
  let resumeData: ResumeData | undefined;
  let optimizedResume = resumeBlock;

  const jsonMatch = resumeBlock.match(RESUME_JSON_FENCE);
  if (jsonMatch && jsonMatch[1]) {
    const candidate = jsonMatch[1].trim();
    try {
      const parsed = JSON.parse(candidate) as ResumeData;
      // Ensure required arrays exist, even if empty — keeps the PDF safe.
      resumeData = {
        ...parsed,
        contact: parsed.contact ?? {},
        coreSkills: Array.isArray(parsed.coreSkills) ? parsed.coreSkills : [],
        experience: Array.isArray(parsed.experience) ? parsed.experience : [],
        education: Array.isArray(parsed.education) ? parsed.education : [],
        certifications: Array.isArray(parsed.certifications)
          ? parsed.certifications
          : [],
        languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      };
    } catch {
      // Bad JSON — leave resumeData undefined, but still strip the fence
      // from the plain text view so it doesn't look broken.
    }
    optimizedResume = resumeBlock.replace(RESUME_JSON_FENCE, '').trim();
  }

  let coverLetter = '';
  if (coverMatch && coverMatch.index !== undefined) {
    const coverContentStart = coverMatch.index + coverMatch[0].length;
    const coverEnd =
      interviewMatch && interviewMatch.index !== undefined
        ? interviewMatch.index
        : normalized.length;
    coverLetter = normalized.slice(coverContentStart, coverEnd).trim();
  }

  let interviewPrep = '';
  if (interviewMatch && interviewMatch.index !== undefined) {
    interviewPrep = normalized
      .slice(interviewMatch.index + interviewMatch[0].length)
      .trim();
  }

  return {
    optimizedResume,
    coverLetter,
    interviewPrep,
    resumeData,
    raw,
  };
}
