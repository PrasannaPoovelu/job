import type { Job, ResumeProfile, ScoredJob } from './types';
import type { ProviderId } from '../types';

/**
 * Tiny LLM facade used by the recruiter logic.
 *
 * We do NOT depend on any specific provider here — instead we accept a
 * generic "ask" function that takes a system+user prompt and returns text.
 * This lets us reuse the same Gemini/Anthropic clients that already exist
 * in src/agent without coupling.
 */
export type AskFn = (system: string, user: string) => Promise<string>;

/* ────────────────────────────────────────────────────────────────────
 *  Resume profile extractor
 * ──────────────────────────────────────────────────────────────────── */

const PROFILE_SYSTEM = `You are an expert technical recruiter. Read the candidate's resume and produce a STRICT JSON object describing the most realistic roles they should target right now. Do NOT inflate seniority. Do NOT invent skills. Use ONLY information visible in the resume.

Output rules:
- Return ONLY the JSON object inside a single \`\`\`json fenced block. No prose, no explanation.
- Schema:
  {
    "primaryRole": "Concrete role title to use as a search query (e.g. 'Senior Front-End Developer', 'Data Analyst')",
    "alternativeRoles": ["1–3 closely related role titles also worth searching"],
    "seniority": "entry | mid | senior | lead | principal",
    "yearsExperience": <integer>,
    "topSkills": ["8–12 most relevant skills / tools the candidate genuinely has"],
    "targetLocations": ["India", "United Kingdom", "United States", "Remote", ...],
    "industryFit": ["2–4 industries / sectors that match the candidate's background"]
  }`;

const PROFILE_FENCE = /```json\s*\n([\s\S]*?)```/i;

/** Whole-word, case-insensitive presence check (handles `.` `+` `#`). */
function hasTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'i').test(haystack);
}

/** Best-effort heuristic profile, used as the demo-mode fallback. */
export function heuristicProfile(resumeText: string): ResumeProfile {
  const lower = resumeText.toLowerCase();
  const yearsMatch = resumeText.match(/(\d+)\+?\s*years?/i);
  const years = yearsMatch ? Math.min(parseInt(yearsMatch[1], 10), 30) : 3;
  const seniority: ResumeProfile['seniority'] =
    years >= 12 ? 'principal' : years >= 8 ? 'lead' : years >= 4 ? 'senior' : years >= 2 ? 'mid' : 'entry';

  const skills: string[] = [];
  // Order matters — list specific terms BEFORE their substrings (e.g. JavaScript before Java).
  const skillCatalogue = [
    'React.js', 'TypeScript', 'JavaScript', 'Next.js', 'Node.js', 'Python',
    'Java', 'SQL', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
    'Tailwind CSS', 'Redux Toolkit', 'Redux', 'GraphQL', 'REST API', 'CI/CD',
    'GitLab', 'Vitest', 'Jest', 'Cypress', 'Figma', 'Agile', 'Scrum',
  ];
  for (const s of skillCatalogue) {
    if (hasTerm(resumeText, s)) skills.push(s);
    if (skills.length >= 12) break;
  }

  // Pick a primary role from a few common patterns
  const isFE = /(react|front[- ]?end|ui|frontend)/.test(lower);
  const isBE = /(backend|node|spring|django|api server)/.test(lower);
  const isData = /(data analyst|data scientist|machine learning|ml|nlp)/.test(lower);
  const isPM = /(product manager|pm |product owner)/.test(lower);
  const isDesign = /(figma|ux designer|ui designer)/.test(lower);
  const sLabel =
    seniority === 'entry' ? 'Junior' :
    seniority === 'mid' ? '' :
    seniority === 'senior' ? 'Senior' :
    seniority === 'lead' ? 'Lead' : 'Principal';
  const role = isFE
    ? `${sLabel} Front-End Developer`.trim()
    : isBE
      ? `${sLabel} Backend Engineer`.trim()
      : isData
        ? `${sLabel} Data Scientist`.trim()
        : isPM
          ? `${sLabel} Product Manager`.trim()
          : isDesign
            ? `${sLabel} Product Designer`.trim()
            : `${sLabel} Software Engineer`.trim();

  const altRoles = isFE
    ? ['React Engineer', 'Web Developer', 'UI Engineer']
    : isBE
      ? ['Software Engineer', 'API Developer']
      : ['Software Engineer'];

  return {
    primaryRole: role,
    alternativeRoles: altRoles,
    seniority,
    yearsExperience: years,
    topSkills: skills.length ? skills : ['Communication', 'Teamwork'],
    targetLocations: ['India', 'Remote', 'United Kingdom', 'United States'],
    industryFit: isFE || isBE ? ['SaaS', 'Fintech', 'Consulting'] : ['Technology'],
  };
}

export async function extractResumeProfile(
  resumeText: string,
  ask: AskFn | null,
): Promise<ResumeProfile> {
  if (!ask) return heuristicProfile(resumeText);

  const userMsg = `<candidate_resume>\n${resumeText.trim()}\n</candidate_resume>`;
  let raw = '';
  try {
    raw = await ask(PROFILE_SYSTEM, userMsg);
  } catch {
    return heuristicProfile(resumeText);
  }

  const match = raw.match(PROFILE_FENCE);
  if (!match) return heuristicProfile(resumeText);

  try {
    const parsed = JSON.parse(match[1].trim()) as Partial<ResumeProfile>;
    const fallback = heuristicProfile(resumeText);
    return {
      primaryRole: parsed.primaryRole?.trim() || fallback.primaryRole,
      alternativeRoles: parsed.alternativeRoles ?? fallback.alternativeRoles,
      seniority: parsed.seniority ?? fallback.seniority,
      yearsExperience: parsed.yearsExperience ?? fallback.yearsExperience,
      topSkills:
        parsed.topSkills && parsed.topSkills.length > 0
          ? parsed.topSkills
          : fallback.topSkills,
      targetLocations: parsed.targetLocations ?? fallback.targetLocations,
      industryFit: parsed.industryFit ?? fallback.industryFit,
    };
  } catch {
    return heuristicProfile(resumeText);
  }
}

/* ────────────────────────────────────────────────────────────────────
 *  Fit scorer — batches up to 10 jobs per LLM call
 * ──────────────────────────────────────────────────────────────────── */

const SCORER_SYSTEM = `You are an expert technical recruiter. For each job below, decide how good a fit it is for the candidate (0-100) based ONLY on their resume and the job's title + description.

Scoring rubric:
  • 80-100: strong match — title and 70%+ skills overlap
  • 60-79 : reasonable match — relevant title or several overlapping skills
  • 40-59 : possible stretch — partial overlap or adjacent role
  • 0-39  : poor match — wrong domain or seniority

Output rules:
- Return ONLY a single \`\`\`json fenced block.
- Format: { "scores": [ { "id": "<job id>", "score": <int 0-100>, "reasons": ["1-2 short bullets"] }, ... ] }
- One entry per job, in the order given.
- Do NOT invent jobs that weren't in the input.`;

const BATCH_SIZE = 10;

interface ScoreEntry {
  id: string;
  score: number;
  reasons: string[];
}

function categoryFor(score: number): ScoredJob['category'] {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'stretch';
}

/** Heuristic fit score — used in demo mode or when LLM call fails. */
function heuristicScore(job: Job, profile: ResumeProfile): ScoreEntry {
  const text = `${job.title} ${job.description}`;
  const skills = profile.topSkills;
  const matched = skills.filter((s) => s && hasTerm(text, s));
  const skillScore = skills.length === 0 ? 0 : (matched.length / skills.length) * 60;

  // Title match boost
  const primaryWords = profile.primaryRole.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const titleHits = primaryWords.filter((w) => job.title.toLowerCase().includes(w)).length;
  const titleScore = primaryWords.length === 0 ? 0 : (titleHits / primaryWords.length) * 40;

  const score = Math.round(Math.min(100, skillScore + titleScore));
  const reasons: string[] = [];
  if (matched.length > 0) {
    reasons.push(`Matches ${matched.length}/${skills.length} of your top skills`);
  }
  if (titleHits > 0) {
    reasons.push(`Title overlaps with "${profile.primaryRole}"`);
  }
  if (reasons.length === 0) {
    reasons.push('Adjacent role — consider as a stretch.');
  }
  return { id: job.id, score, reasons };
}

export async function scoreJobs(
  jobs: Job[],
  profile: ResumeProfile,
  resumeText: string,
  ask: AskFn | null,
  providerId?: ProviderId,
): Promise<ScoredJob[]> {
  if (jobs.length === 0) return [];

  // Demo / no-LLM path: score deterministically from keyword overlap.
  if (!ask || providerId === 'demo') {
    return jobs.map((j) => {
      const e = heuristicScore(j, profile);
      return {
        ...j,
        fitScore: e.score,
        fitReasons: e.reasons,
        category: categoryFor(e.score),
      };
    });
  }

  // LLM path — batch to keep prompt size + cost low.
  const result = new Map<string, ScoreEntry>();

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const userMsg = [
      '<candidate_resume>',
      resumeText.trim(),
      '</candidate_resume>',
      '',
      `<candidate_target_role>${profile.primaryRole}</candidate_target_role>`,
      '',
      '<jobs>',
      ...batch.map(
        (j, idx) =>
          `Job ${idx + 1} (id: ${j.id})\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}\nDescription: ${j.description.slice(0, 800)}`,
      ),
      '</jobs>',
    ].join('\n');

    let raw = '';
    try {
      raw = await ask(SCORER_SYSTEM, userMsg);
    } catch {
      // LLM batch failed — fall back to heuristic for this batch.
      for (const j of batch) {
        result.set(j.id, heuristicScore(j, profile));
      }
      continue;
    }

    const fenceMatch = raw.match(/```json\s*\n([\s\S]*?)```/i);
    let parsed: { scores?: ScoreEntry[] } | null = null;
    if (fenceMatch) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim());
      } catch {
        parsed = null;
      }
    }
    const scores = parsed?.scores ?? [];

    for (const j of batch) {
      const found = scores.find((s) => s.id === j.id);
      if (
        found &&
        typeof found.score === 'number' &&
        Array.isArray(found.reasons)
      ) {
        result.set(j.id, {
          id: j.id,
          score: Math.max(0, Math.min(100, Math.round(found.score))),
          reasons: found.reasons.slice(0, 3).map((r) => String(r)),
        });
      } else {
        result.set(j.id, heuristicScore(j, profile));
      }
    }
  }

  return jobs.map((j) => {
    const e = result.get(j.id) ?? heuristicScore(j, profile);
    return {
      ...j,
      fitScore: e.score,
      fitReasons: e.reasons,
      category: categoryFor(e.score),
    };
  });
}

/** Group scored jobs into the three priority buckets, each sorted desc by score. */
export function categorizeJobs(scored: ScoredJob[]) {
  const high: ScoredJob[] = [];
  const medium: ScoredJob[] = [];
  const stretch: ScoredJob[] = [];
  for (const j of scored) {
    if (j.category === 'high') high.push(j);
    else if (j.category === 'medium') medium.push(j);
    else stretch.push(j);
  }
  const desc = (a: ScoredJob, b: ScoredJob) => b.fitScore - a.fitScore;
  high.sort(desc);
  medium.sort(desc);
  stretch.sort(desc);
  return { high, medium, stretch };
}
