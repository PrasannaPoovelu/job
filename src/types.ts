export type Region = 'USA' | 'UK' | 'Europe' | 'India' | 'Other';

export interface AgentInput {
  jobDescription: string;
  resume: string;
  region: Region;
}

/** Structured resume schema used by the PDF renderer. */
export interface ResumeData {
  name: string;
  /** e.g. "Front-End Developer · React.js & TypeScript Specialist" */
  title?: string;
  /** A short tagline below the title — italic in the PDF. */
  tagline?: string;
  contact: {
    phone?: string;
    email?: string;
    linkedin?: string;
    github?: string;
    location?: string;
    website?: string;
  };
  /** A short professional summary (UK/Europe/India formats). */
  summary?: string;
  /** Two-column skills table: left = label, right = comma-joined values. */
  coreSkills: { label: string; values: string[] }[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  languages: string[];
}

export interface ExperienceEntry {
  role: string;
  company: string;
  location?: string;
  /** e.g. "Jun 2024 – Present" */
  dates: string;
  /** Optional project / sub-role line, e.g. "Central PEP Repository (CPR) – Barclays". */
  subtitle?: string;
  bullets: string[];
}

export interface EducationEntry {
  degree: string;
  school: string;
  location?: string;
  dates?: string;
}

export interface CertificationEntry {
  name: string;
  issuer?: string;
  date?: string;
  /** e.g. "Cert No: wknud4pv4feo" */
  reference?: string;
}

export interface AgentOutput {
  optimizedResume: string;
  coverLetter: string;
  interviewPrep: string;
  /** Structured resume for the PDF download. Optional — may be missing. */
  resumeData?: ResumeData;
  /** Deterministic before/after metrics — populated by App after agent runs. */
  metrics?: import('./utils/metrics').ResumeMetrics;
  /** Raw model response, kept for debugging / "view raw" toggle. */
  raw: string;
}

export type AgentStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'success'; output: AgentOutput }
  | { kind: 'error'; message: string };

/** Provider tag — used by the UI to label which backend produced the output. */
export type ProviderId = 'anthropic' | 'gemini' | 'demo';

/** Common surface every agent backend implements. */
export interface Agent {
  readonly providerId: ProviderId;
  run(input: AgentInput): Promise<AgentOutput>;
  /**
   * Generic single-shot completion — used by side features (job scorer,
   * resume profile extractor) that need raw model output.
   * Demo agents may throw or return synthetic content.
   */
  ask?(systemPrompt: string, userMessage: string): Promise<string>;
}
