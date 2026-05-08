import type {
  Agent,
  AgentInput,
  AgentOutput,
  ProviderId,
  Region,
  ResumeData,
} from '../types';

/**
 * DemoAgent — a deterministic, offline fallback that produces template
 * output without calling any API.
 *
 * Used when:
 *   1. The user enables `VITE_USE_DEMO_MODE=true` in `.env.local`, OR
 *   2. The Anthropic API returns a billing error and the user clicks the
 *      "Try in Demo Mode" button.
 *
 * Output is intentionally labeled as DEMO so the user is never confused
 * about whether they got real AI-tailored content.
 */

const DEMO_NOTICE = `[DEMO MODE — generated locally from a template, not by an LLM]
For real AI-optimized output, configure VITE_GEMINI_API_KEY (free) or
VITE_ANTHROPIC_API_KEY in .env.local.`;

const KEYWORD_PATTERN =
  /\b(JavaScript|TypeScript|React|Node\.?js|Python|Java|Go|Rust|Ruby|PHP|Swift|Kotlin|C\+\+|C#|SQL|NoSQL|AWS|Azure|GCP|Docker|Kubernetes|CI\/CD|Git|Agile|Scrum|REST|GraphQL|Vue|Angular|Next\.?js|Django|Flask|Express|MongoDB|PostgreSQL|MySQL|Redis|Kafka|TensorFlow|PyTorch|Pandas|NumPy|Tableau|PowerBI|Excel|machine learning|deep learning|data science|product management|leadership|communication|teamwork)\b/gi;

export function extractKeywords(text: string, max = 12): string[] {
  const found = new Set<string>();
  KEYWORD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KEYWORD_PATTERN.exec(text)) !== null) {
    found.add(match[0]);
    if (found.size >= max) break;
  }
  return Array.from(found);
}

export function extractCompany(jd: string): string {
  const m =
    jd.match(/\b(?:at|join|with)\s+([A-Z][A-Za-z0-9&. ]{2,40}?)(?:[,.\n]|\s+is\b|\s+we\b)/) ??
    jd.match(/\b([A-Z][A-Za-z0-9&.]{2,40})\s+is\s+hiring/);
  return m?.[1].trim() ?? 'the company';
}

export function extractRole(jd: string): string {
  const firstLine = jd
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return 'this role';
  return firstLine.length > 70 ? firstLine.slice(0, 67) + '…' : firstLine;
}

/** Pull contact info out of free-text resume content. */
export function extractContact(resume: string): ResumeData['contact'] {
  const phone = resume.match(/\+?\d[\d\s\-().]{7,}\d/)?.[0]?.trim();
  const email = resume.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const linkedin = resume.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0];
  const github = resume.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0];
  return {
    phone,
    email,
    linkedin,
    github,
  };
}

/** Use the first non-empty resume line as the candidate's name. */
export function extractName(resume: string): string {
  const firstLine = resume
    .split('\n')
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length > 0 &&
        l.length < 60 &&
        !l.includes('@') &&
        !/^\+?\d/.test(l),
    );
  return firstLine ?? 'Candidate';
}

function regionGuidance(region: Region): string {
  switch (region) {
    case 'USA':
      return 'Keep to 1–2 pages. No photo or personal details. Use strong, impact-driven bullets.';
    case 'UK':
      return 'Add a 3–4 line professional summary at the top. Slightly more descriptive than US format.';
    case 'Europe':
      return 'A concise personal profile is acceptable. Keep clean, structured sections.';
    case 'India':
      return 'Standard professional formatting. Lead with summary and key skills.';
    default:
      return 'Apply standard professional formatting for your target market.';
  }
}

function buildResumeText(input: AgentInput, keywords: string[], role: string): string {
  return [
    DEMO_NOTICE,
    '',
    '═════════════════════════════════════',
    `OPTIMIZED RESUME — ${input.region} format`,
    '═════════════════════════════════════',
    '',
    `Tailored for: ${role}`,
    '',
    'Key keywords detected in the job description:',
    keywords.length
      ? keywords.map((k) => `  • ${k}`).join('\n')
      : '  (no common tech/skill keywords detected — try a more detailed JD)',
    '',
    '─── YOUR RESUME (passed through) ───',
    input.resume.trim(),
    '',
    '─── SUGGESTED IMPROVEMENTS (template) ───',
    '1. Lead each bullet with a strong action verb (Led, Architected, Delivered, Scaled).',
    '2. Quantify impact: percentages, dollar amounts, time saved, user/transaction scale.',
    "3. Mirror the JD's exact terminology where you have the experience — don't paraphrase.",
    '4. Front-load the keywords above into your Skills/Summary sections for ATS.',
    `5. ${regionGuidance(input.region)}`,
  ].join('\n');
}

function buildCoverLetter(
  _input: AgentInput,
  keywords: string[],
  company: string,
  role: string,
): string {
  const top3 = keywords.slice(0, 3);
  return [
    DEMO_NOTICE,
    '',
    `Dear Hiring Manager at ${company},`,
    '',
    `I'm writing to express my interest in the ${role} role. After reviewing the`,
    'job description, I believe my background aligns well with what your team is',
    `looking for — particularly around ${
      top3.length ? top3.join(', ') : 'the core competencies you described'
    }.`,
    '',
    '[In live mode, the LLM would weave specific achievements from your resume',
    'into this paragraph, mapping each one to a JD requirement with quantified',
    'impact. The DEMO template stays intentionally generic.]',
    '',
    `I'm especially drawn to ${company} because [the LLM would extract the mission`,
    'or product context from the JD and personalize this sentence].',
    '',
    "I'd welcome the chance to discuss how I can contribute. Thank you for your",
    'consideration.',
    '',
    'Sincerely,',
    '[Your name]',
  ].join('\n');
}

function buildInterviewPrep(keywords: string[], role: string): string {
  const techQuestions = keywords.length
    ? keywords
        .slice(0, 5)
        .map((k, i) => `  ${i + 1}. Walk me through a project where you used ${k}.`)
        .join('\n')
    : '  (Add tech keywords to the JD to get specific questions.)';

  const reviseTopics = keywords.length
    ? keywords.map((k) => `  • ${k} — fundamentals, common pitfalls, recent updates`).join('\n')
    : [
        '  • Core CS / domain fundamentals',
        '  • Common system-design patterns',
        '  • Strong behavioral STAR stories',
      ].join('\n');

  return [
    DEMO_NOTICE,
    '',
    `INTERVIEW PREPARATION GUIDE — ${role}`,
    '',
    'A. LIKELY TECHNICAL QUESTIONS',
    techQuestions,
    '',
    'B. BEHAVIORAL QUESTIONS (STAR-method ready)',
    '  1. Tell me about a time you led a project under tight deadlines.',
    '  2. Describe a conflict with a teammate and how you resolved it.',
    '  3. Walk me through your biggest professional failure.',
    "  4. Give an example of how you've simplified a complex problem.",
    '',
    'C. SCENARIO QUESTIONS',
    '  1. Your top-priority project is at risk of slipping. What do you do?',
    '  2. A stakeholder asks for a feature you believe is the wrong call. How do you handle it?',
    '',
    'D. KEY TOPICS TO REVISE',
    reviseTopics,
    '',
    'E. STAR ANSWER TEMPLATE',
    '  Situation: 1–2 sentences setting the context.',
    '  Task:      What you specifically owned.',
    '  Action:    What you did, in concrete steps. Lead with verbs.',
    '  Result:    Quantified outcome — %, $, time saved, scale.',
    '',
    '[In live mode, the LLM generates full STAR answers using your real resume.]',
  ].join('\n');
}

/**
 * Best-effort structured resume from free-text input. Demo mode never has
 * full structure (no role/dates parsing), so we populate what we can — the
 * PDF renderer happily handles missing fields.
 */
function buildResumeData(
  input: AgentInput,
  keywords: string[],
  role: string,
): ResumeData {
  return {
    name: extractName(input.resume),
    title: role,
    tagline: `Optimized for ${input.region} hiring standards (demo template)`,
    contact: extractContact(input.resume),
    summary:
      input.region === 'UK' || input.region === 'Europe'
        ? `Experienced professional aligned with the role's core requirements (${keywords.slice(0, 4).join(', ') || 'multiple key skills'}). [Demo summary — the LLM would write a tailored version.]`
        : undefined,
    coreSkills: keywords.length
      ? [{ label: 'Detected Keywords', values: keywords }]
      : [],
    experience: [
      {
        role: '[Your most recent role]',
        company: '[Company]',
        dates: '[Dates]',
        bullets: [
          '[Demo mode does not parse structured experience from free text.]',
          'Live LLM output will populate this section from your actual resume.',
        ],
      },
    ],
    education: [],
    certifications: [],
    languages: [],
  };
}

export class DemoAgent implements Agent {
  readonly providerId: ProviderId = 'demo';

  async run(input: AgentInput): Promise<AgentOutput> {
    if (!input.jobDescription.trim()) {
      throw new Error('Job description is empty.');
    }
    if (!input.resume.trim()) {
      throw new Error('Resume is empty.');
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    const keywords = extractKeywords(input.jobDescription);
    const company = extractCompany(input.jobDescription);
    const role = extractRole(input.jobDescription);

    const optimizedResume = buildResumeText(input, keywords, role);
    const coverLetter = buildCoverLetter(input, keywords, company, role);
    const interviewPrep = buildInterviewPrep(keywords, role);
    const resumeData = buildResumeData(input, keywords, role);

    return {
      optimizedResume,
      coverLetter,
      interviewPrep,
      resumeData,
      raw: [optimizedResume, coverLetter, interviewPrep].join('\n\n'),
    };
  }
}
