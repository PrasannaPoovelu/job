/** Normalized job posting from any source. URL is always a real, verified link. */
export interface Job {
  /** Stable id within source (e.g. Adzuna's id, Muse's id). */
  id: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  /** Plain-text description, truncated to ~1.5k chars to keep LLM cost low. */
  description: string;
  /** Real apply / detail URL returned by the API. */
  url: string;
  /** ISO date string when the job was posted, if known. */
  posted?: string;
  salary?: string;
  remote?: boolean;
  tags?: string[];
}

export type JobSource = 'adzuna' | 'jsearch' | 'themuse' | 'remotive';

/** Result of LLM scoring for a single job. */
export interface ScoredJob extends Job {
  fitScore: number; // 0-100
  fitReasons: string[]; // 1-3 short bullets
  category: 'high' | 'medium' | 'stretch';
}

/** What the LLM extracts from the resume to drive the search. */
export interface ResumeProfile {
  primaryRole: string;
  alternativeRoles: string[];
  seniority: 'entry' | 'mid' | 'senior' | 'lead' | 'principal' | 'unknown';
  yearsExperience: number;
  topSkills: string[];
  /** Free-text country / city / remote tags. e.g. ["India", "United Kingdom", "Remote"]. */
  targetLocations: string[];
  industryFit: string[];
}

/** Search query passed to job-source clients. */
export interface JobSearchQuery {
  keywords: string;
  location?: string;
  /** ISO 2-letter country code if the source supports it (Adzuna). */
  country?: string;
  /** 1-based page number. */
  page?: number;
  /** Result count per page (best effort — sources may cap). */
  perPage?: number;
}
