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
  code?: string; // e.g., "1.1", "vak", "0"
  kind?: 'regular'|'vacation'|'zero';
}

export type TemplateArtifact = {
  name: string;
  evl: string[]; // codes
  cases: string[]; // names/ids
  knowledge: string[]; // names/ids
  vraak: { variatie:number; relevantie:number; authenticiteit:number; actualiteit:number; kwantiteit:number };
  kind?: 'document'|'toets'|'performance'|'certificaat'|'overig';
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

export function getCurriculumForYear(startYear: number){
  const byYear = readJson<Record<number,{evl:EVL[];courses:Course[]}>>(LS_KEYS.curriculumByYear, {})
  return byYear[startYear] || getCurriculum()
}

export async function importYearsFromPublic(): Promise<Array<{id:string;year:number;weeks:WeekInfo[]}>>{
  try{
    // Probeer eerst submap-variant met index in public/Jaarplanningen/index.json, val terug op oude root year-index.json
    const tryLoadIndex = async (url: string) => {
      try{
        const resp = await fetch(url)
        if(!resp.ok) return null
        const arr = await resp.json() as string[]
        return Array.isArray(arr) ? arr : null
      }catch{ return null }
    }
    const idxFromSubdir = await tryLoadIndex('/Jaarplanningen/index.json')
    const usedBase = idxFromSubdir ? '/Jaarplanningen/' : '/'
    const idx = idxFromSubdir ?? (await tryLoadIndex('/year-index.json')) ?? []
    if(idx.length===0){ return getYears() }
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
      // Bepaal fetch-pad: items in subdir-index zijn vaak bestandsnamen, in root-index vaak rootpaden
      const rawPath = String(file||'').trim()
      const isAbsolute = rawPath.startsWith('/')
      const hasSlash = rawPath.includes('/')
      const resolvedPath = isAbsolute ? rawPath : (hasSlash ? `/${rawPath}` : `${usedBase}${rawPath}`)
      const res = await fetch(`${encodeURI(resolvedPath)}`)
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { header:1 }) as any[][]
      // verwachte kolommen: Lesweek | Datum | Jaar (voorbeeld in NL)
      const header = rows[0].map((v:any)=> String(v||''))
      const lesIdx = header.findIndex(h=>/lesweek/i.test(h))
      const datIdx = header.findIndex(h=>/datum/i.test(h))
      const yIdx   = header.findIndex(h=>/jaar|year/i.test(h))
      // Fallback: leid studiejaarstart af uit bestandsnaam, bv. 25-26 → 2025
      const mYear = rawPath.match(/(\d{2})\s*[-_]\s*(\d{2})/)
      const yearFromFile = mYear ? (2000 + Number(mYear[1])) : undefined
      let currentRowYear: number|undefined = yearFromFile
      let schoolYearStart: number|undefined = yearFromFile
      const counters = new Map<number, number>()
      for(let i=1;i<rows.length;i++){
        const r = rows[i]
        if(!r || (r.every((c:any)=> c==null || c===''))) continue
        const lesweekCell = String(r[lesIdx] ?? '').trim()
        const yearCell = r[yIdx]
        if(yearCell) currentRowYear = Number(yearCell)
        if(!schoolYearStart && currentRowYear) schoolYearStart = currentRowYear
        if(!schoolYearStart) continue
        if(/semester/i.test(lesweekCell)) { continue } // headerregel overslaan
        const codeMatch = lesweekCell.match(/^(\d+\.\d+)/)
        const code = codeMatch ? codeMatch[1] : ( /vakantie/i.test(lesweekCell) ? 'vak' : (/jaarafsluiting|nulweek/i.test(lesweekCell)? '0' : (/^0\./.test(lesweekCell) ? '0' : undefined)))
        const isHoliday = code==='vak'
        const kind: 'regular'|'vacation'|'zero' = isHoliday ? 'vacation' : (/^0(\.|$)/.test(String(code||'')) ? 'zero' : 'regular')
        // datum kan zijn "18-aug" of "2-feb" → splits op '-'
        const cellVal = r[datIdx]
        let startISO = ''
        if(cellVal!=null){
          if(typeof cellVal === 'number'){
            const d = XLSX.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(cellVal) : null
            if(d){
              const mm = String(d.m).padStart(2,'0'); const dd = String(d.d).padStart(2,'0')
              const yyyy = (currentRowYear ?? d.y)
              startISO = `${yyyy}-${mm}-${dd}`
            }
          }else{
            const datText = String(cellVal)
            const m = datText.match(/(\d{1,2})[-\s]?([A-Za-z]{3})/)
            if(m){ startISO = toISO(m[1], m[2], (currentRowYear ?? yearFromFile)) }
          }
        }
        const arr = yearToWeeks.get(schoolYearStart) || []
        const nextNum = (counters.get(schoolYearStart) || 0) + 1
        counters.set(schoolYearStart, nextNum)
        arr.push({
          week: nextNum,
          label: code ? code : (lesweekCell || `Week ${nextNum}`),
          startISO,
          endISO: startISO,
          isHoliday,
          holidayLabel: isHoliday ? lesweekCell : undefined,
          code: code,
          kind
        })
        yearToWeeks.set(schoolYearStart, arr)
      }
    }
    const out = Array.from(yearToWeeks.entries()).map(([year,weeks])=> ({ id:`year_${year}`, year, weeks }))
    if(out.length>0){ writeJson(LS_KEYS.years, out) }
    return out
  }catch{
    return getYears()
  }
}

// Templates import (sjablonen)
export async function importTemplatesFromPublic(): Promise<TemplateArtifact[]>{
  try{
    // Probeer submap-index eerst, val terug op oude root index
    const tryLoad = async (url:string) => { try{ const r=await fetch(url); if(!r.ok) return null; const j=await r.json() as string[]; return Array.isArray(j)?j:null }catch{ return null } }
    const idx = (await tryLoad('/Sjablonen/index.json')) ?? (await tryLoad('/sjablonen-index.json'))
    if(!idx) return readJson('pf-templates', [] as TemplateArtifact[])
    const out: TemplateArtifact[] = []
    for(const file of idx){
      const res = await fetch(encodeURI(`/${file}`))
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(sheet)
      for(const r of rows){
        const name = String(r['Naam']||r['name']||'').trim()
        if(!name) continue
        const evl = String(r['EVL']||'').split(',').map((s:string)=>s.trim()).filter(Boolean)
        const casesCol = (r as any)['Casussen'] ?? (r as any)['Thema’s'] ?? (r as any)["Thema's"] ?? (r as any)['Themas'] ?? (r as any)['Thema'] ?? ''
        const cases = String(casesCol||'').split(',').map((s:string)=>s.trim()).filter(Boolean)
        const knowledge = String(r['Kennis']||'').split(',').map((s:string)=>s.trim()).filter(Boolean)
        const vraak = {
          variatie: Number(r['Variatie']||3), relevantie: Number(r['Relevantie']||3), authenticiteit: Number(r['Authenticiteit']||3), actualiteit: Number(r['Actualiteit']||3), kwantiteit: Number(r['Kwantiteit']||3)
        }
        const kind = String(r['Soort']||'overig').toLowerCase() as any
        out.push({ name, evl, cases, knowledge, vraak, kind })
      }
    }
    writeJson('pf-templates', out)
    return out
  }catch{
    return readJson('pf-templates', [] as TemplateArtifact[])
  }
}

// Curriculum import per jaar vanuit public/Cursus-info/index.json
export async function importCurriculumFromPublic(): Promise<Record<number,{evl:EVL[];courses:Course[]}>>{
  try{
    // Laad index uit submap
    const idxResp = await fetch('/Cursus-info/index.json')
    if(!idxResp.ok){ return readJson(LS_KEYS.curriculumByYear, {}) }
    const files = await idxResp.json() as string[]
    if(import.meta && (import.meta as any).env && (import.meta as any).env.DEV){
      console.log('[curriculum] index files', files)
    }
    const byYear = readJson<Record<number,{evl:EVL[];courses:Course[]}>>(LS_KEYS.curriculumByYear, {})

    for(const file of files){
      const res = await fetch(encodeURI(`/${file}`))
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const matrixRows = XLSX.utils.sheet_to_json<any>(sheet, { header:1 }) as any[][]

      // Jaar bepalen uit bestandsnaam (25-26 → 2025) of uit optionele kolom
      let yearFromFile: number|undefined
      {
        const m = file.match(/(\d{2})\s*[-_]\s*(\d{2})/)
        if(m){ yearFromFile = 2000 + Number(m[1]) }
      }
      // Zoek header-regel heuristisch in de eerste 10 rijen
      let headerRowIdx = 0
      for(let i=0;i<Math.min(10, matrixRows.length); i++){
        const row = (matrixRows[i]||[]).map(v=> String(v||'').trim())
        const hasCourseCol = row.some(h=> /^(portfolio|cursus|course)$/i.test(h))
        const hasSignals = row.some(h=> /^(evl\s*[1-5]|kennis|casus|thema|[1-5]\.[0-9]+)/i.test(h))
        if(hasCourseCol && hasSignals){ headerRowIdx = i; break }
      }
      const header = (matrixRows[headerRowIdx]||[]).map(v=> String(v||'').trim())
      // (unused) const normalize = (s:string)=> s.toLowerCase().replace(/\s+/g,' ').trim()
      const isChecked = (v:any)=>{
        const t = String(v||'').toLowerCase().trim()
        return t==='v' || t==='x' || t==='ja' || t==='true' || t==='1'
      }
      const isOutcomeCol = (title:string)=> /^([1-5])\.([0-9]+)$/.test(title.trim())

      // Vind indices
      const courseIdx = (()=>{
        const idx = header.findIndex(h=>/^(portfolio|cursus|course)$/i.test(h))
        return idx>=0 ? idx : 0
      })()
      const kennisToggleIdx = header.findIndex(h=>/kennis/i.test(h))
      // Alle casus/thema kolommen
      const casusHeaderEntries = header.map((h,idx)=> ({h:String(h||''),idx}))
        .filter(x=> /casus|thema/i.test(x.h))
      const isCasusToggleHeader = (title:string)=>{
        const norm = String(title||'').toLowerCase().replace(/[’'`]/g,'').replace(/\s+/g,' ')
        const hasDigits = /\d/.test(norm)
        return !hasDigits && norm.includes('casus') && norm.includes('thema')
      }
      const explicitCasusToggle = casusHeaderEntries.find(x=> isCasusToggleHeader(x.h))
      const casusToggleIdx = explicitCasusToggle ? explicitCasusToggle.idx : -1
      const casusNameIdxs = casusHeaderEntries
        .filter(x=> x.idx!==casusToggleIdx)
        .filter(x=> /\d/.test(x.h)) // kolommen genummerd (casus/thema1..n)
        .map(x=> x.idx)

      // Start met default EVL‑namen; outcomes vullen we op basis van kolomtitels
      const evlMap: Record<EVL['id'], { id: EVL['id']; name: string; outcomes: Outcome[] }> = {
        EVL1: { id:'EVL1', name: (EVLS.find(e=>e.id==='EVL1')?.name)||'EVL1', outcomes: [] },
        EVL2: { id:'EVL2', name: (EVLS.find(e=>e.id==='EVL2')?.name)||'EVL2', outcomes: [] },
        EVL3: { id:'EVL3', name: (EVLS.find(e=>e.id==='EVL3')?.name)||'EVL3', outcomes: [] },
        EVL4: { id:'EVL4', name: (EVLS.find(e=>e.id==='EVL4')?.name)||'EVL4', outcomes: [] },
        EVL5: { id:'EVL5', name: (EVLS.find(e=>e.id==='EVL5')?.name)||'EVL5', outcomes: [] },
      }
      const courseList: Course[] = []
      let targetYear: number|undefined = yearFromFile

      // Bepaal outcome kolommen per EVL:
      // 1) dynamische secties na een kolomtitel die op EVL1..EVL5 matcht
      // 2) fallback: titels die op ^([1-5])\.[0-9]+$ matchen
      const outcomeColMeta: Array<{idx:number; id:string; name:string; evlId:EVL['id']}> = []
      let currentEvl: EVL['id'] | null = null
      for(let i=0;i<header.length;i++){
        const titleRaw = String(header[i]||'').trim()
        const title = titleRaw
        if(/^evl\s*([1-5])\b/i.test(title)){
          const num = Number(title.match(/([1-5])/i)?.[1]||'') as 1|2|3|4|5
          currentEvl = (`EVL${num}` as EVL['id'])
          continue
        }
        if(/kennis/i.test(title) || /casus|thema/i.test(title) || /portfolio|cursus|course/i.test(title)){
          currentEvl = null
          continue
        }
        if(currentEvl){
          const id = title || `outcome_${currentEvl}_${i}`
          // voeg toe indien nog niet bekend voor deze EVL
          if(!outcomeColMeta.some(m=> m.idx===i)){
            outcomeColMeta.push({ idx:i, id, name:title||id, evlId: currentEvl })
          }
          continue
        }
        const m = title.match(/^([1-5])\.([0-9]+)(.*)$/)
        if(m){
          const evlId = (`EVL${Number(m[1])}` as EVL['id'])
          const id = `${m[1]}.${m[2]}`
          outcomeColMeta.push({ idx:i, id, name:title, evlId })
        }
      }

      // Kennis domeinen: primair alle kolommen na de kennis-toggle die geen outcome zijn en niet casus/evl
      let knowledgeIdxs = header
        .map((h,idx)=> ({h,idx}))
        .filter(x=> kennisToggleIdx>=0 && x.idx>kennisToggleIdx)
        .filter(x=> !isOutcomeCol(x.h) && !/evl/i.test(x.h) && !/casus|thema/i.test(x.h) && !/^(portfolio|cursus|course|jaar|year)$/i.test(x.h))
        .map(x=> x.idx)
      // Fallback: als geen kennis-toggle of niets gevonden, neem alle kolommen rechts van de laatste outcome-kolom
      if(knowledgeIdxs.length===0){
        const lastOutcomeIdx = outcomeColMeta.reduce((m,c)=> Math.max(m, c.idx), -1)
        knowledgeIdxs = header
          .map((h,idx)=> ({h,idx}))
          .filter(x=> x.idx>lastOutcomeIdx)
          .filter(x=> !/evl/i.test(x.h) && !/casus|thema/i.test(x.h) && !isOutcomeCol(x.h) && !/^(portfolio|cursus|course|jaar|year)$/i.test(x.h))
          .map(x=> x.idx)
      }
      // Voeg alle gevonden outcomes toe aan EVL-lijst (naam = kolomtitel)
      for(const meta of outcomeColMeta){
        const list = evlMap[meta.evlId].outcomes
        if(!list.find(o=>o.id===meta.id)) list.push({ id: meta.id, name: meta.name })
      }

      // Per-cursus verzameling van toegestane outcomes
      const allowedByCourse = new Map<string, Map<EVL['id'], Set<string>>>()

      for(let r=headerRowIdx+1;r<matrixRows.length;r++){
        const row = matrixRows[r]
        if(!row || row.every(c=> c==null || String(c).trim()==='')) continue
        const courseName = String(row[courseIdx]||'').trim()
        if(!courseName) continue

        // Optioneel jaar kolom
        const yearIdx = header.findIndex(h=>/^(jaar|year)$/i.test(h))
        const yCell = yearIdx>=0 ? row[yearIdx] : undefined
        const y = Number(yCell || '')
        if(!targetYear && y){ targetYear = y }

        // EVL vinkjes → per-cursus allowed outcomes
        const courseId = `course_${courseName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}`
        let perCourse = allowedByCourse.get(courseId)
        if(!perCourse){ perCourse = new Map<EVL['id'], Set<string>>(); allowedByCourse.set(courseId, perCourse) }
        for(const meta of outcomeColMeta){
          const cell = row[meta.idx]
          if(isChecked(cell)){
            const set = perCourse.get(meta.evlId) || new Set<string>()
            set.add(meta.id)
            perCourse.set(meta.evlId, set)
          }
        }

        // Casus/thema
        const cases: { id:string; name:string }[] = []
        const casusAllowed = (casusToggleIdx<0) || isChecked(row[casusToggleIdx]) || casusNameIdxs.some(i=> String(row[i]||'').trim()!=='')
        if(casusAllowed){
          for(const i of casusNameIdxs){
            const val = String(row[i]||'').trim()
            if(val){ cases.push({ id: `case_${i}_${val.toLowerCase()}`, name: val }) }
          }
        }

        // Kennisdomeinen
        const knowledgeDomains: { id:string; name:string }[] = []
        const anyDomainChecked = knowledgeIdxs.some(i=> isChecked(row[i]))
        const knAllowed = (kennisToggleIdx<0) || isChecked(row[kennisToggleIdx]) || anyDomainChecked
        for(const i of knowledgeIdxs){
          const title = String(header[i]||'').trim()
          const val = row[i]
          if(!title) continue
          // Neem domein mee als toegestaan en het vakje bij het domein is aangevinkt
          if(knAllowed && isChecked(val)){
            knowledgeDomains.push({ id:`kn_${i}_${title.toLowerCase()}`, name:title })
          }
        }

        courseList.push({ id: courseId, name: courseName, cases, knowledgeDomains })
      }

      const evlList: EVL[] = (Object.values(evlMap) as any)
      // Zet per-cursus evlOverrides (excluded) op basis van allowed sets
      const allByEvl = new Map<EVL['id'], string[]>()
      for(const evl of evlList){ allByEvl.set(evl.id as EVL['id'], evl.outcomes.map(o=>o.id)) }
      for(const c of courseList){
        const perCourse = allowedByCourse.get(c.id) || new Map<EVL['id'], Set<string>>()
        const overrides: Record<string,string[]> = {}
        for(const [evlId, allOutcomes] of allByEvl.entries()){
          const allowed = perCourse.get(evlId) || new Set<string>()
          const excluded = allOutcomes.filter(id=> !allowed.has(id))
          if(excluded.length>0) overrides[evlId] = excluded
        }
        if(Object.keys(overrides).length>0){ (c as any).evlOverrides = overrides }
      }
      if(targetYear){
        // Als parser niets vond, probeer minimaal cursussen uit eerste kolom (fallback)
        if(courseList.length===0){
          const courseIdxFallback = header.findIndex(h=>/^(portfolio|cursus|course)$/i.test(h)) >=0 ? header.findIndex(h=>/^(portfolio|cursus|course)$/i.test(h)) : 0
          for(let r=headerRowIdx+1;r<matrixRows.length;r++){
            const nm = String((matrixRows[r]||[])[courseIdxFallback]||'').trim()
            if(nm) courseList.push({ id:`course_${nm.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}`, name:nm, cases:[], knowledgeDomains:[] })
          }
        }
        byYear[targetYear] = { evl: evlList, courses: courseList }
      }
    }
    writeJson(LS_KEYS.curriculumByYear, byYear)
    if(import.meta && (import.meta as any).env && (import.meta as any).env.DEV){
      console.log('[curriculum] imported years', Object.keys(byYear).map(k=>`${k}(${byYear[Number(k)]?.courses?.length||0} courses)`))
    }
    return byYear
  }catch{
    return readJson(LS_KEYS.curriculumByYear, {})
  }
}


