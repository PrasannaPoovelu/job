/**
 * Deterministic resume-vs-JD metrics.
 *
 * No LLM is involved — these numbers are computed locally so they're
 * reproducible, work in Demo Mode, and can't be hallucinated.
 *
 * Strategy:
 *   1. Pull a set of high-signal keywords from the JD using a curated
 *      tech/soft-skill list + capitalized phrase detection.
 *   2. Check which keywords appear in the original resume → "before %".
 *   3. Check which keywords appear in the optimized resume → "after %".
 *   4. Compute a weighted ATS score from match %, bullets, and
 *      quantified-impact density.
 *   5. Diff the two sets to surface "keywords added".
 */

export interface ResumeMetrics {
  /** Keywords detected in the JD (capped — see EXTRACT_LIMIT). */
  jdKeywords: string[];
  /** % of JD keywords found in the original resume. */
  beforeMatchPct: number;
  /** % of JD keywords found in the optimized resume. */
  afterMatchPct: number;
  /** 0–100 score combining keyword match, bullets, and quantified impact. */
  atsScore: number;
  /** JD keywords now in the optimized resume that weren't in the original. */
  keywordsAdded: string[];
  /** JD keywords still missing from the optimized resume. */
  keywordsMissing: string[];
}

const EXTRACT_LIMIT = 30;

/**
 * Curated catalogue of high-signal terms. Order matters only for ties;
 * matching is done with word-boundary regex so case / punctuation don't
 * trip it up.
 */
const TECH_TERMS: string[] = [
  // Frontend / Languages
  'JavaScript', 'TypeScript', 'React.js', 'React', 'Next.js', 'Vue', 'Angular',
  'Svelte', 'HTML5', 'HTML', 'CSS3', 'CSS', 'Sass', 'SCSS', 'Less',
  // State / Data
  'Redux Toolkit', 'Redux', 'Zustand', 'MobX', 'Context API',
  'TanStack Query', 'React Query', 'Axios', 'SWR',
  // UI / Styling
  'Tailwind CSS', 'Tailwind', 'Bootstrap', 'Material UI', 'MUI',
  'Chakra UI', 'styled-components', 'Emotion', 'Figma', 'Sketch',
  // Backend / Languages
  'Node.js', 'Express', 'Nest.js', 'Python', 'Django', 'Flask', 'FastAPI',
  'Java', 'Spring Boot', 'Spring', 'C#', '.NET', 'Go', 'Rust', 'Ruby',
  'Rails', 'PHP', 'Laravel', 'Swift', 'Kotlin',
  // APIs
  'REST API', 'REST', 'GraphQL', 'gRPC', 'WebSocket', 'OAuth', 'JWT',
  // Testing
  'Vitest', 'Jest', 'Cypress', 'Playwright', 'Selenium', 'Mocha',
  'React Testing Library', 'Unit Testing', 'Integration Testing',
  'E2E', 'TDD', 'BDD',
  // Build / Tools
  'Vite', 'Webpack', 'Rollup', 'Babel', 'ESLint', 'Prettier',
  'Storybook', 'npm', 'Yarn', 'pnpm',
  // Cloud / Infra
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform',
  'Serverless', 'Lambda',
  // CI / SCM
  'CI/CD', 'Jenkins', 'GitLab', 'GitHub Actions', 'GitHub', 'Bitbucket',
  'Git', 'Jira', 'Confluence',
  // Data
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'Elasticsearch',
  'Snowflake', 'BigQuery', 'SQL', 'NoSQL',
  // ML / DS
  'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn',
  'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
  // Product / Process
  'Agile', 'Scrum', 'Kanban', 'Waterfall',
  // Web concerns
  'PWA', 'SSR', 'SSG', 'WCAG', 'Accessibility', 'SEO',
  'Performance', 'Lazy Loading', 'Code Splitting', 'Memoization',
  'Micro-frontends', 'Microservices', 'Monorepo',
  // Soft / leadership
  'Leadership', 'Mentoring', 'Communication', 'Collaboration',
  'Teamwork', 'Problem Solving', 'Code Reviews', 'Clean Code',
];

/** Words to exclude from the multi-cap fallback. */
const STOPWORDS = new Set([
  'The', 'A', 'An', 'And', 'Or', 'But', 'Of', 'In', 'On', 'At', 'To',
  'For', 'With', 'By', 'From', 'Is', 'Are', 'We', 'You', 'They', 'I',
  'This', 'That', 'These', 'Those', 'It', 'As', 'If', 'So', 'About',
  'Job', 'Role', 'Position', 'Team', 'Company', 'Candidate', 'Required',
  'Requirements', 'Responsibilities', 'Qualifications', 'Experience',
  'Skills', 'Description', 'Summary', 'Overview', 'Apply', 'Hiring',
  'Looking', 'Seeking', 'Strong', 'Bonus', 'Plus', 'Etc', 'Year', 'Years',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word, case-insensitive presence check. */
export function containsTerm(haystack: string, term: string): boolean {
  if (!term) return false;
  // Allow internal punctuation in terms like "Node.js" or "C#" by treating
  // boundaries flexibly: must not be preceded/followed by a letter or digit.
  const re = new RegExp(`(?<![\\w-])${escapeRegex(term)}(?![\\w-])`, 'i');
  return re.test(haystack);
}

/**
 * Pull keywords from the JD. We start with the curated catalogue (highest
 * signal) and supplement with capitalized 1–3 word phrases (catches things
 * like "Spring Boot" or "GitLab Duo AI" that aren't in the catalogue).
 */
export function extractJdKeywords(jd: string, max = EXTRACT_LIMIT): string[] {
  const found = new Set<string>();
  // 1. Curated catalogue
  for (const term of TECH_TERMS) {
    if (containsTerm(jd, term)) found.add(term);
    if (found.size >= max) return Array.from(found);
  }
  // 2. Multi-cap fallback (e.g. "Spring Boot", "GitLab Duo AI").
  //    Use [ \t]+ instead of \s+ so the match never crosses a newline,
  //    and require each token to start with a capital + lowercase letter
  //    to avoid junk like "REST APIs" or "GitLab CI" overlapping catalogue hits.
  const multiCapRe =
    /\b([A-Z][a-z][A-Za-z0-9]{1,18}(?:[ \t]+[A-Z][a-z][A-Za-z0-9]{1,18}){1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = multiCapRe.exec(jd)) !== null) {
    const phrase = m[1].trim();
    if (phrase.length < 4 || phrase.length > 40) continue;
    const head = phrase.split(/\s+/)[0];
    if (STOPWORDS.has(head)) continue;
    // Skip if any catalogue/found term already covers this phrase or vice versa.
    const lower = phrase.toLowerCase();
    if ([...found].some((t) => t.toLowerCase() === lower)) continue;
    if ([...found].some((t) => lower.includes(t.toLowerCase()))) continue;
    if ([...found].some((t) => t.toLowerCase().includes(lower))) continue;
    found.add(phrase);
    if (found.size >= max) break;
  }
  return Array.from(found);
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** Heuristic ATS score (0–100) for the optimized resume. */
function computeAtsScore(optimizedResume: string, afterMatchPct: number): number {
  // 60 points: keyword coverage of JD
  const keywordScore = afterMatchPct * 0.6;

  // 15 points: bullet density (good resumes have plenty)
  const bulletCount = (optimizedResume.match(/^\s*[•▸\-*]/gm) ?? []).length;
  const bulletScore = Math.min(bulletCount * 1.5, 15);

  // 15 points: quantified-impact density (numbers, %, $, x)
  const quantHits =
    (optimizedResume.match(/\b\d+\s*%/g) ?? []).length +
    (optimizedResume.match(/\$\s*\d+/g) ?? []).length +
    (optimizedResume.match(/\b\d+x\b/gi) ?? []).length +
    (optimizedResume.match(/\b\d{3,}\b/g) ?? []).length;
  const quantScore = Math.min(quantHits * 2, 15);

  // 10 points: reasonable length (250–900 words)
  const wordCount = optimizedResume.split(/\s+/).filter(Boolean).length;
  const lengthScore =
    wordCount >= 250 && wordCount <= 900 ? 10 : wordCount > 100 ? 6 : 2;

  return Math.min(100, Math.round(keywordScore + bulletScore + quantScore + lengthScore));
}

export function computeMetrics(
  jd: string,
  originalResume: string,
  optimizedResume: string,
): ResumeMetrics {
  const jdKeywords = extractJdKeywords(jd);
  const before = jdKeywords.filter((k) => containsTerm(originalResume, k));
  const after = jdKeywords.filter((k) => containsTerm(optimizedResume, k));

  const beforeMatchPct = pct(before.length, jdKeywords.length);
  const afterMatchPct = pct(after.length, jdKeywords.length);

  const beforeSet = new Set(before.map((k) => k.toLowerCase()));
  const afterSet = new Set(after.map((k) => k.toLowerCase()));

  const keywordsAdded = after.filter((k) => !beforeSet.has(k.toLowerCase()));
  const keywordsMissing = jdKeywords.filter(
    (k) => !afterSet.has(k.toLowerCase()),
  );

  const atsScore = computeAtsScore(optimizedResume, afterMatchPct);

  return {
    jdKeywords,
    beforeMatchPct,
    afterMatchPct,
    atsScore,
    keywordsAdded,
    keywordsMissing,
  };
}
