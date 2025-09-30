export const LS_KEYS = {
  plans: 'pf-portfolio-plans',
  curriculum: 'pf-curriculum',
  curriculumByYear: 'pf-curriculum-by-year',
  years: 'pf-year-planners',
  ui: 'pf-ui-preferences',
  help: 'pf-help-seen'
} as const;

export type VraakScore = {
  variatie: number;
  relevantie: number;
  authenticiteit: number;
  actualiteit: number;
  kwantiteit: number;
}

// Herkomstperiode wanneer de prestatie niet in de gekoppelde lesweek plaatsvond
export type EvidenceAgeBracket = 'lt6m' | '6to12m' | '1to2y' | '2to3y' | 'gt3y'

export type Artifact = {
  id: string;
  name: string;
  week: number;
  evlOutcomeIds: string[]; // bijv. ['2.1','4.3']
  caseIds: string[];
  knowledgeIds: string[];
  vraak: VraakScore;
  perspectives?: PerspectiveKey[];
  // Vrij tekstveld voor extra context/aanpak
  note?: string;
  createdAt: number;
  updatedAt: number;
  kind?: 'document'|'toets'|'performance'|'certificaat'|'overig';
  // Optioneel: wanneer bewijs uit eerdere periode komt dan de lesweek
  occurrenceAge?: EvidenceAgeBracket;
}

// Perspectieven (slugs). UI toont bijbehorende labels.
export type PerspectiveKey =
  | 'zelfreflectie'
  | 'docent'
  | 'student-p'
  | 'student-hf1'
  | 'student-hf2-3'
  | 'stagebegeleider'
  | 'patient'
  | 'overig'

export type PortfolioPlan = {
  id: string;
  name: string;
  year: number;
  courseId: string;
  courseName: string;
  period: { type: 'periode'|'semester'|'maatwerk'; value: number|[number,number]; label: string };
  artifacts: Artifact[];
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
}

export function readJson<T>(key: string, fallback: T): T {
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw) as T;
  }catch{
    return fallback;
  }
}

export function writeJson(key: string, value: unknown){
  localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(prefix: string){
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2,8);
  return `${prefix}_${time}_${rand}`;
}


