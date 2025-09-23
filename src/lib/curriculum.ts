import { LS_KEYS, readJson, writeJson } from './storage';
import * as XLSX from 'xlsx'

export type Outcome = { id: string; name: string };
export type EVL = { id: 'EVL1'|'EVL2'|'EVL3'|'EVL4'|'EVL5'; name: string; outcomes: Outcome[] };
export type Course = {
  id: string;
  name: string;
  cases: { id: string; name: string }[];
  knowledgeDomains: { id: string; name: string }[];
  evlOverrides?: Record<string,string[]>; // EVL id -> excluded outcome ids
}

export type WeekInfo = {
  week: number;
  label: string; // e.g., "Week 1"
  startISO: string; // ISO date (yyyy-mm-dd) for Monday
  endISO: string;   // ISO date (yyyy-mm-dd) for Sunday
  isHoliday: boolean;
  holidayLabel?: string;
}

const EVLS: EVL[] = [
  { id: 'EVL1', name: 'Diagnostisch handelen', outcomes: [
    { id: '1.1', name: 'Screenen' },
    { id: '1.2', name: 'Uitvoeren anamnese' },
    { id: '1.3', name: 'Uitvoeren lichamelijk onderzoek' },
    { id: '1.4', name: 'Fysiotherapeutische diagnose stellen' }
  ] },
  { id: 'EVL2', name: 'Therapeutisch handelen', outcomes: [
    { id: '2.1', name: 'Behandelplan ontwerpen' },
    { id: '2.2', name: 'Behandelplan uitvoeren' },
    { id: '2.3', name: 'Monitoren, bijsturen en evalueren' },
    { id: '2.4', name: 'Informeren en dossier voeren in het EPD' }
  ] },
  { id: 'EVL3', name: 'Preventief handelen', outcomes: [
    { id: '3.1', name: 'Selectieve preventie' },
    { id: '3.2', name: 'Geïndiceerde preventie' },
    { id: '3.3', name: 'Zorggerelateerde preventie' }
  ] },
  { id: 'EVL4', name: 'Professioneel handelen en samenwerken', outcomes: [
    { id: '4.1', name: 'Sturen van het eigen leerproces' },
    { id: '4.2', name: 'Bijdragen aan professionele ontwikkeling van anderen' },
    { id: '4.3', name: 'Professionele grondhouding' },
    { id: '4.4', name: 'Samen leren en werken' }
  ] },
  { id: 'EVL5', name: 'Onderzoekend handelen', outcomes: [
    { id: '5.1', name: 'Wetenschappelijke literatuur zoeken en beoordelen' },
    { id: '5.2', name: 'Praktijkonderzoek doen' },
    { id: '5.3', name: 'Ondernemen' }
  ] }
];

const COURSES: Course[] = [
  {
    id: 'course_r2p',
    name: 'Return2Performance',
    cases: [
      { id: 'case_eigen', name: 'eigen casus' },
      { id: 'case_enkel', name: 'enkel' },
      { id: 'case_knie', name: 'knie' }
    ],
    knowledgeDomains: [
      { id: 'kd_anatomie', name: 'Anatomie' },
      { id: 'kd_pathofys', name: 'Pathofysiologie' },
      { id: 'kd_gedrag', name: 'Gedrag & Communicatie' },
      { id: 'kd_vak', name: 'Vak fysiotherapie' }
    ],
    evlOverrides: { EVL1: ['1.1'] }
  }
];

function toISODate(d: Date){
  return d.toISOString().slice(0,10)
}

// Return Monday of ISO week for given year/week
function getMondayOfISOWeek(year: number, week: number){
  const simple = new Date(Date.UTC(year, 0, 4)) // Jan 4 is always in week 1
  const dayOfWeek = simple.getUTCDay() || 7
  const mondayWeek1 = new Date(simple)
  mondayWeek1.setUTCDate(simple.getUTCDate() - dayOfWeek + 1)
  const monday = new Date(mondayWeek1)
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week-1)*7)
  return monday
}

function weeksInISOYear(year: number){
  const dec28 = new Date(Date.UTC(year, 11, 28))
  // ISO week of Dec 28 equals number of weeks in year
  const oneJan = new Date(Date.UTC(year,0,1))
  const dayOfWeek = (dec28.getUTCDay() + 6) % 7 // 0=Mon
  const thursday = new Date(dec28)
  thursday.setUTCDate(dec28.getUTCDate() - dayOfWeek + 3)
  const firstThursday = new Date(oneJan)
  const firstDayOfWeek = (oneJan.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(oneJan.getUTCDate() - firstDayOfWeek + 3)
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7*24*3600*1000))
  return week
}

function seedYear(year: number){
  const total = weeksInISOYear(year)
  const defaultHolidayWeeks = {
    2025: [8, 14, 30,31,32,33,34, 43, 52], // grove indicatie; kan via admin worden aangepast
    2026: [8, 30,31,32,33,34, 52]
  } as Record<number, number[]>
  const holidays = new Set(defaultHolidayWeeks[year] || [])
  const weeks: WeekInfo[] = Array.from({length: total}, (_,idx)=>{
    const w = idx+1
    const start = getMondayOfISOWeek(year, w)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate()+6)
    return {
      week: w,
      label: `Week ${w}`,
      startISO: toISODate(start),
      endISO: toISODate(end),
      isHoliday: holidays.has(w),
      holidayLabel: holidays.has(w) ? 'Vakantie' : undefined
    }
  })
  return { id: `year_${year}`, year, weeks };
}

export function ensureSeed(){
  const cur = readJson(LS_KEYS.curriculum, null as any);
  if(!cur){
    writeJson(LS_KEYS.curriculum, { evl: EVLS, courses: COURSES });
  }
  const yrs = readJson(LS_KEYS.years, null as any);
  if(!yrs){
    writeJson(LS_KEYS.years, [seedYear(2025), seedYear(2026)]);
  }
}

export function getCurriculum(){
  return readJson(LS_KEYS.curriculum, { evl: EVLS, courses: COURSES }) as { evl: EVL[]; courses: Course[] };
}
export function getYears(){
  return readJson(LS_KEYS.years, [seedYear(2025), seedYear(2026)]) as Array<{id:string;year:number;weeks:WeekInfo[]}>;
}

export async function importYearsFromPublic(): Promise<Array<{id:string;year:number;weeks:WeekInfo[]}>>{
  try{
    const idx = await fetch('/year-index.json').then(r=>r.json()) as string[]
    const yearToWeeks = new Map<number, WeekInfo[]>()
    const months: Record<string,string> = { jan:'01', feb:'02', mrt:'03', apr:'04', mei:'05', jun:'06', jul:'07', aug:'08', sep:'09', okt:'10', nov:'11', dec:'12' }
    const toISO = (day: string|number|undefined|null, monText: string|undefined, year?: number) => {
      if(!day || !monText || !year) return ''
      const dd = String(day).padStart(2,'0')
      const key = monText.toLowerCase().slice(0,3)
      const mm = months[key]
      if(!mm) return ''
      return `${year}-${mm}-${dd}`
    }
    for(const file of idx){
      const res = await fetch(`/${encodeURIComponent(file)}`)
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { header:1 }) as any[][]
      // verwachte kolommen: Lesweek | Datum | Jaar (voorbeeld in NL)
      const header = rows[0].map((v:any)=> String(v||''))
      const lesIdx = header.findIndex(h=>/lesweek/i.test(h))
      const datIdx = header.findIndex(h=>/datum/i.test(h))
      const yIdx   = header.findIndex(h=>/jaar|year/i.test(h))
      let curYear: number|undefined
      const counters = new Map<number, number>()
      for(let i=1;i<rows.length;i++){
        const r = rows[i]
        if(!r || (r.every((c:any)=> c==null || c===''))) continue
        const lesweekCell = String(r[lesIdx] ?? '').trim()
        const yearCell = r[yIdx]
        if(yearCell) curYear = Number(yearCell)
        if(!curYear) continue
        if(/semester/i.test(lesweekCell)) { continue } // headerregel overslaan
        const isNumericWeek = /^\d+(\.\d+)?/.test(lesweekCell)
        const isHoliday = /vakantie/i.test(lesweekCell) || /jaara?fsluiting/i.test(lesweekCell)
        // datum kan zijn "18-aug" of "2-feb" → splits op '-'
        const datText = String(r[datIdx] ?? '')
        let startISO = ''
        if(datText){
          const m = datText.match(/(\d{1,2})[-\s]?([A-Za-z]{3})/)
          if(m){ startISO = toISO(m[1], m[2], curYear) }
        }
        const arr = yearToWeeks.get(curYear) || []
        const nextNum = (counters.get(curYear) || 0) + 1
        counters.set(curYear, nextNum)
        arr.push({
          week: nextNum,
          label: isNumericWeek ? `Lesweek ${lesweekCell}` : lesweekCell || `Week ${nextNum}`,
          startISO,
          endISO: startISO,
          isHoliday,
          holidayLabel: isHoliday ? lesweekCell : undefined
        })
        yearToWeeks.set(curYear, arr)
      }
    }
    const out = Array.from(yearToWeeks.entries()).map(([year,weeks])=> ({ id:`year_${year}`, year, weeks }))
    if(out.length>0){ writeJson(LS_KEYS.years, out) }
    return out
  }catch{
    return getYears()
  }
}


