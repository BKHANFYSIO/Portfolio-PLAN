import { useEffect, useMemo, useRef, useState } from 'react'
import type { PortfolioPlan, Artifact } from '../lib/storage'
import { LS_KEYS, readJson, writeJson } from '../lib/storage'
import { getCurriculumForYear, getYears } from '../lib/curriculum'
import './weekMatrix.css'
import { KindIcon, PerspectiveIcon } from './icons'

type Props = { plan: PortfolioPlan; onEdit?: (a: Artifact)=>void }

export default function WeekMatrix({ plan, onEdit }: Props){
  const { evl, courses } = getCurriculumForYear(plan.year)
  const years = getYears()
  const course = courses.find(c=>c.id===plan.courseId)
  const evlForCourse = useMemo(()=> {
    const overrides = (course?.evlOverrides) || {}
    return evl.map(b => {
      const excluded = (overrides as any)[b.id] || []
      return ({ ...b, outcomes: b.outcomes.filter(o=> !excluded.includes(o.id)) })
    })
  }, [evl, course])
  const weeks = useMemo(()=>{
    const year = years.find(y=>y.year===plan.year)
    const all = (year?.weeks || [])
    if(plan.period?.type==='periode'){
      const p = Number(plan.period.value)
      const filtered = all.filter(w=> w.kind!=='zero')
      const startIdx = filtered.findIndex(w => String(w.code||'') === `${p}.1`)
      if(startIdx === -1) return filtered.map(w=>w.week)
      const nextIdx = filtered.findIndex(w => String(w.code||'') === `${p+1}.1`)
      const endIdx = nextIdx === -1 ? filtered.length : nextIdx
      return filtered.slice(startIdx, endIdx).map(w=>w.week)
    }
    if(plan.period?.type==='semester'){
      const s = Number(plan.period.value)
      const filtered = all.filter(w=> w.kind!=='zero')
      const idxFor = (label:string)=> filtered.findIndex(w=> String(w.code||'')===label)
      const p1 = idxFor('1.1'); const p3 = idxFor('3.1')
      if(p1>=0 && p3>p1){
        if(s===1) return filtered.slice(p1, p3).map(w=>w.week)
        return filtered.slice(p3).map(w=>w.week)
      }
      // fallback: halve verdeling
      const half = Math.ceil(filtered.length/2)
      if(s===1) return filtered.slice(0,half).map(w=>w.week)
      return filtered.slice(half).map(w=>w.week)
    }
    if(plan.period?.type==='maatwerk' && Array.isArray(plan.period.value)){
      const [start,end] = plan.period.value
      return all.filter(w=> w.week>=start && w.week<=end).map(w=>w.week)
    }
    return all.map(w=>w.week)
  }, [plan.year, years, plan.period])

  // Hulpfuncties voor lesweek-labels
  const getWeekInfo = (weekNum: number) => {
    const y = years.find(y=>y.year===plan.year)
    return y?.weeks.find(ww=> ww.week===weekNum)
  }
  const formatLesweek = (weekNum: number) => {
    const info = getWeekInfo(weekNum)
    if(!info) return `Week ${weekNum}`
    const base = info.code || info.label || `Week ${weekNum}`
    const prefix = info.code ? 'Lesweek ' : ''
    const date = info.startISO ? ` · ${info.startISO}` : ''
    return `${prefix}${base}${date}`
  }

  // const rows = useMemo(()=> evlForCourse.flatMap(b => b.outcomes.map(o => ({ evlId: b.id, lukId: o.id, name: o.name }))), [evlForCourse])
  const [openCasus, setOpenCasus] = useState<boolean>(true)
  const [openKennis, setOpenKennis] = useState<boolean>(true)

  const [open, setOpen] = useState<Record<string, boolean>>(()=>Object.fromEntries(evlForCourse.map(b=>[b.id,true])))
  function toggleBlock(id: string){ setOpen(s=> ({...s, [id]: !s[id]})) }

  function artifactsIn(lukId: string, week: number){
    return (plan.artifacts||[]).filter(a => a.week===week && a.evlOutcomeIds.includes(lukId))
  }

  // removed unused kindIcon

// (verwijderd: gemiddelde helper onnodig)

  // Bereken VRAAK-balken per verzameling artifacts en (optioneel) per-subrij ids
  function computeVraakBars(arts: Artifact[], subIds?: string[]): { v:number; r:number; a1:number; a2:number; k:number; meta?: any }{
    const clamp = (x:number)=> Math.max(1, Math.min(5, x))
    if(!arts || arts.length===0){
      return { v:1, r:1, a1:1, a2:1, k:1 }
    }
    // Helpers
    const unique = <T,>(arr:T[]) => Array.from(new Set(arr))
    const perspectiveCoverage = (perspList: string[]): number => {
      const s = new Set(perspList.map(p=> String(p)))
      const must = ['docent','zelfreflectie','student-hf2-3']
      const baseCount = must.filter(p=> s.has(p)).length
      const hasStudent = s.has('student-p') || s.has('student-hf1')
      const total = baseCount + (hasStudent?1:0)
      return Math.min(1, total/4)
    }
    const timeSpreadForWeeks = (weeksForItems: number[]): number => {
      if(weeks.length===0) return 0
      const idxByWeek = new Map<number, number>()
      weeks.forEach((w, i)=> idxByWeek.set(w, i))
      const validIdx = weeksForItems.map(w=> idxByWeek.get(w)).filter((i): i is number => typeof i==='number')
      if(validIdx.length===0) return 0
      const n = weeks.length
      const seg = Math.max(1, Math.floor(n/3))
      const segIdx = (i:number)=> Math.min(2, Math.floor(i/seg))
      const buckets = new Set(validIdx.map(i=> segIdx(i)))
      return Math.min(1, buckets.size/3)
    }

    // Variatie-score: combineert soorten bewijs, perspectief-dekking en tijdspreiding (elk 1/3)
    const scorePerGroup = (groupArts: Artifact[]) => {
      const kinds = unique(groupArts.map(a=> a.kind||'overig')).length
      const sKinds = Math.min(1, kinds/3)
      const allPersp = unique(groupArts.flatMap(a=> Array.isArray(a.perspectives)?a.perspectives:[])) as string[]
      const sPersp = perspectiveCoverage(allPersp)
      const weeksHere = unique(groupArts.map(a=> a.week)) as number[]
      const sTime = timeSpreadForWeeks(weeksHere)
      const v01 = (sKinds + sPersp + sTime) / 3
      return v01
    }

    let v01: number
    if(subIds && subIds.length>0){
      const perSub = subIds.map(id => {
        const inSub = arts.filter(a=> (a.evlOutcomeIds||[]).includes(id) || (a.caseIds||[]).includes(id) || (a.knowledgeIds||[]).includes(id))
        if(inSub.length===0) return 0
        return scorePerGroup(inSub)
      })
      v01 = perSub.reduce((a,b)=>a+b,0)/perSub.length
    }else{
      v01 = scorePerGroup(arts)
    }
    const v = clamp(1 + 4*Math.max(0, Math.min(1, v01)))

    // Maak meta voor tooltips/uitleg (gebaseerd op alle arts samen)
    const allKinds = unique(arts.map(a=> a.kind||'overig')).length
    const allPersp = unique(arts.flatMap(a=> Array.isArray(a.perspectives)?a.perspectives:[])) as string[]
    const perspSet = new Set(allPersp.map(p=> String(p)))
    const perspPresent = {
      docent: perspSet.has('docent'),
      zelfreflectie: perspSet.has('zelfreflectie'),
      hf23: perspSet.has('student-hf2-3'),
      spOrHf1: (perspSet.has('student-p') || perspSet.has('student-hf1'))
    }
    const perspCount = (perspPresent.docent?1:0) + (perspPresent.zelfreflectie?1:0) + (perspPresent.hf23?1:0) + (perspPresent.spOrHf1?1:0)
    const allWeeksHere = unique(arts.map(a=> a.week)) as number[]
    const n = weeks.length
    const seg = Math.max(1, Math.floor(n/3))
    const idxByWeek = new Map<number, number>()
    weeks.forEach((w, i)=> idxByWeek.set(w, i))
    const validIdx = allWeeksHere.map(w=> idxByWeek.get(w)).filter((i): i is number => typeof i==='number')
    const segIdx = (i:number)=> Math.min(2, Math.floor(i/seg))
    const filled = new Set(validIdx.map(i=> segIdx(i))).size
    const meta = {
      variation: {
        kindsCount: allKinds, kindsMax: 3,
        persp: { ...perspPresent, presentCount: perspCount, max: 4 },
        time: { filled, total: 3 },
        weights: { kinds: 1/3, persp: 1/3, time: 1/3 }
      }
    }

    // Relevantie: Top-2 gemiddelde per subrij – ontbrekende telt als 1
    const top2Avg = (list: Artifact[]) => {
      const vals = (list||[]).map(a=> (a.vraak?.relevantie ?? 1)).sort((a,b)=> b-a)
      const r1 = vals[0] ?? 1
      const r2 = vals[1] ?? 1
      return (r1 + r2) / 2 // schaal 1..5
    }
    let r01 = 0
    if(subIds && subIds.length>0){
      const perSub = subIds.map(id => arts.filter(a=> (a.evlOutcomeIds||[]).includes(id) || (a.caseIds||[]).includes(id) || (a.knowledgeIds||[]).includes(id)))
      const perSubScores = perSub.map(list => top2Avg(list)) // 1..5
      const avg = perSubScores.reduce((a,b)=>a+b,0) / (perSubScores.length||1) // 1..5
      r01 = Math.max(0, Math.min(1, (avg - 1) / 4))
      ;(meta as any).relevance = { method:'top2-avg', note:'gem. van top-2; ontbrekende=1', samples: perSubScores }
    }else{
      const s = top2Avg(arts) // 1..5
      r01 = Math.max(0, Math.min(1, (s - 1) / 4))
      ;(meta as any).relevance = { method:'top-2-avg', note:'gem. van top-2; ontbrekende=1', samples: [s] }
    }
    const r = clamp(1 + 4*Math.max(0, Math.min(1, r01)))

    // Authenticiteit: zelfde principe als relevantie – top‑2 gemiddelde per subrij; ontbrekende telt als 1
    let a1 = 1
    if(subIds && subIds.length>0){
      const perSub = subIds.map(id => arts.filter(a=> (a.evlOutcomeIds||[]).includes(id) || (a.caseIds||[]).includes(id) || (a.knowledgeIds||[]).includes(id)))
      const perSubScores = perSub.map(list => {
        const vals = (list||[]).map(a=> (a.vraak?.authenticiteit ?? 1)).sort((a,b)=> b-a)
        const s1 = vals[0] ?? 1
        const s2 = vals[1] ?? 1
        return (s1 + s2) / 2 // 1..5
      })
      const avg = perSubScores.reduce((a,b)=>a+b,0) / (perSubScores.length||1)
      a1 = clamp(avg)
      ;(meta as any).authenticity = { method:'top2-avg', samples: perSubScores }
    }else{
      const vals = (arts||[]).map(a=> (a.vraak?.authenticiteit ?? 1)).sort((a,b)=> b-a)
      const s1 = vals[0] ?? 1
      const s2 = vals[1] ?? 1
      a1 = clamp((s1 + s2)/2)
      ;(meta as any).authenticity = { method:'top2-avg', samples: [a1] }
    }

    // Actualiteit: volgens gekozen periode; top‑2 gemiddelde per subrij, ontbrekende telt als 1
    const actualiteitScore = (a: Artifact): number => {
      const age = (a as any).occurrenceAge as ('lt6m'|'6to12m'|'1to2y'|'2to3y'|'gt3y'|undefined)
      if(!age) return 5
      if(age==='lt6m') return 4
      if(age==='6to12m') return 4
      if(age==='1to2y') return 3
      if(age==='2to3y') return 2
      return 1
    }
    let a2 = 1
    if(subIds && subIds.length>0){
      const perSub = subIds.map(id => arts.filter(a=> (a.evlOutcomeIds||[]).includes(id) || (a.caseIds||[]).includes(id) || (a.knowledgeIds||[]).includes(id)))
      const perSubScores = perSub.map(list => {
        const vals = (list||[]).map(actualiteitScore).sort((a,b)=> b-a)
        const s1 = vals[0] ?? 1
        const s2 = vals[1] ?? 1
        return (s1 + s2) / 2 // 1..5
      })
      const avg = perSubScores.reduce((a,b)=>a+b,0) / (perSubScores.length||1)
      a2 = clamp(avg)
      ;(meta as any).actuality = { method:'top2-avg', mapping:'week=5,<6m=4,6–12m=4,1–2y=3,2–3y=2,>3y=1', samples: perSubScores }
    }else{
      const vals = (arts||[]).map(actualiteitScore).sort((a,b)=> b-a)
      const s1 = vals[0] ?? 1
      const s2 = vals[1] ?? 1
      a2 = clamp((s1 + s2) / 2)
      ;(meta as any).actuality = { method:'top2-avg', mapping:'week=5,<6m=4,6–12m=4,1–2y=3,2–3y=2,>3y=1', samples: [a2] }
    }

    // Kwantiteit: adaptieve verzadiging per subrij, op basis van (V,R,A,A)
    const toV15 = (v01:number)=> 1 + 4*Math.max(0, Math.min(1, v01))
    const top2AvgBy = (list: Artifact[], getter: (a:Artifact)=>number) => {
      const vals = (list||[]).map(getter).sort((a,b)=> b-a)
      const s1 = vals[0] ?? 1
      const s2 = vals[1] ?? 1
      return (s1 + s2) / 2 // 1..5
    }
    const thresholdFromS = (S:number)=> {
      const t = Math.round(5 - 3 * ((S - 1) / 4))
      return Math.max(2, Math.min(5, t))
    }
    let k = 1
    if(subIds && subIds.length>0){
      const perSub = subIds.map(id => arts.filter(a=> (a.evlOutcomeIds||[]).includes(id) || (a.caseIds||[]).includes(id) || (a.knowledgeIds||[]).includes(id)))
      const perSubK = perSub.map(list => {
        const vS = toV15(scorePerGroup(list)) // 1..5
        const rS = top2AvgBy(list, a=> (a.vraak?.relevantie ?? 1)) // 1..5
        const aS = top2AvgBy(list, a=> (a.vraak?.authenticiteit ?? 1)) // 1..5
        const acS = top2AvgBy(list, actualiteitScore) // 1..5
        const S = (vS + rS + aS + acS)/4
        const T = thresholdFromS(S)
        const n = list.length
        return 1 + 4*Math.min(1, n / T)
      })
      k = clamp(perSubK.reduce((a,b)=>a+b,0) / (perSubK.length||1))
      ;(meta as any).quantity = { method:'adaptive-threshold', note:'T afhankelijk van V,R,A,A; 2..5', examples: perSub.map(l=> l.length) }
    }else{
      const vS = v
      const rS = r
      const aS = a1
      const acS = a2
      const S = (vS + rS + aS + acS)/4
      const T = thresholdFromS(S)
      const n = arts.length
      k = clamp(1 + 4*Math.min(1, n / T))
      ;(meta as any).quantity = { method:'adaptive-threshold', note:'T afhankelijk van V,R,A,A; 2..5', n, T }
    }
    return { v,r,a1,a2,k, meta }
  }

  // Tellers-data en rendering voor subrijen
  function computeCountersData(
    arts: Artifact[],
    knownKinds?: string[],
    knownPersps?: string[]
  ): { kinds: Array<[string, number]>; persps: Array<[string, number]> }{
    if(!arts || arts.length===0) return { kinds: [], persps: [] }
    const byKind = new Map<string, number>()
    const byPersp = new Map<string, number>()
    for(const a of arts){
      const k = String(a.kind||'overig')
      byKind.set(k, (byKind.get(k)||0)+1)
      const ps = Array.isArray(a.perspectives) ? a.perspectives : []
      if(ps.length===0){ byPersp.set('—', (byPersp.get('—')||0)+1) }
      for(const p of ps){ byPersp.set(String(p), (byPersp.get(String(p))||0)+1) }
    }
    // Voeg bekende sleutels met 0 toe zodat alles zichtbaar is
    for(const k of (knownKinds||[])){ if(!byKind.has(k)) byKind.set(k, 0) }
    for(const p of (knownPersps||[])){ if(!byPersp.has(p)) byPersp.set(p, 0) }
    const kinds = Array.from(byKind.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
    const persps = Array.from(byPersp.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
    return { kinds, persps }
  }

  // oude uitgebreide tellerweergave verwijderd

  // Samenvatting: totaal, #soorten, #perspectieven
  function renderSummaryCountersFromData(data: { kinds: Array<[string, number]>; persps: Array<[string, number]> }, total: number){
    const kindCount = data.kinds.length
    const perspCount = data.persps.length
    const IconDoc = () => (
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" fill="none" strokeWidth="2" d="M6 2h9l3 3v17H6z"/></svg>
    )
    const IconPeople = () => (
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3" stroke="currentColor" fill="none" strokeWidth="2"/><path stroke="currentColor" fill="none" strokeWidth="2" d="M2 20v-2c0-2.5 3-4.5 6-4.5M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 20v-2c0-2-2.4-3.8-5-4.3"/></svg>
    )
    return (
      <div style={{display:'inline-flex',alignItems:'center',gap:10}}>
        <button className="wm-chip" title="Totaal aantal bewijzen">{total}</button>
        <span title="# verschillende soorten bewijs" style={{display:'inline-flex',alignItems:'center',gap:4}}><IconDoc /> <strong>{kindCount}</strong></span>
        <span title="# verschillende perspectieven" style={{display:'inline-flex',alignItems:'center',gap:4}}><IconPeople /> <strong>{perspCount}</strong></span>
      </div>
    )
  }

  const wrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const hScrollRef = useRef<HTMLDivElement>(null)
  const [spacerW, setSpacerW] = useState<number>(0)
  const dragRef = useRef<{down:boolean; dragging:boolean; lastX:number}>({down:false,dragging:false,lastX:0})
  const [dragging, setDragging] = useState(false)
  const [, forceRerender] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement|null>(null)
  const filterPopRef = useRef<HTMLDivElement|null>(null)
  const [filterTop, setFilterTop] = useState<number>(0)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement|null>(null)
  const viewPopRef = useRef<HTMLDivElement|null>(null)
  const [viewTop, setViewTop] = useState<number>(0)
  const [vraakDetail, setVraakDetail] = useState<null | { title: string; bars: { v:number;r:number;a1:number;a2:number;k:number } }>(null)
  const [countsDetail, setCountsDetail] = useState<null | { title: string; kinds: Array<[string, number]>; persps: Array<[string, number]>; items: Artifact[] }>(null)
  // Weergave-instellingen
  const uiPref = readJson<Record<string, any>>(LS_KEYS.ui, {})
  const [compact, setCompact] = useState<boolean>(uiPref?.compact ?? false)
  const [fit, setFit] = useState<boolean>(uiPref?.fit ?? true)
  const [ultra, setUltra] = useState<boolean>(uiPref?.ultra ?? false)
  const [fsRequested, setFsRequested] = useState<boolean>(false)
  const baseLeft = ultra ? 220 : (compact ? 240 : 260)
  const baseRight = ultra ? 108 : (compact ? 116 : 124)
  const baseRight2 = ultra ? 108 : (compact ? 116 : 124)
  const baseCol = ultra ? 68 : (compact ? 76 : 80)
  const [colWidthPx, setColWidthPx] = useState<number>(baseCol)

  // Filter state
  const artifactsAll = (plan.artifacts||[])
  const allKinds = useMemo(()=> Array.from(new Set(artifactsAll.map(a=> String(a.kind||'').trim()).filter(Boolean))), [artifactsAll])
  const allPersps = useMemo(()=> Array.from(new Set(artifactsAll.flatMap(a=> Array.isArray(a.perspectives)?a.perspectives:[]).filter(Boolean))), [artifactsAll])
  // Bekende sets voor volledige weergave, inclusief categorieën die (nog) 0 keer voorkomen
  // (verwijderd: vaste lijsten niet meer nodig voor huidige samenvatting)
  const [filterKinds, setFilterKinds] = useState<string[]>(Array.isArray(uiPref?.filterKinds)?uiPref.filterKinds:[])
  const [filterPersp, setFilterPersp] = useState<string[]>(Array.isArray(uiPref?.filterPersp)?uiPref.filterPersp:[])
  const [filterMode, setFilterMode] = useState<'dim'|'hide'>(uiPref?.filterMode==='hide'?'hide':'dim')

  useEffect(()=>{
    const next = { ...(readJson<Record<string, any>>(LS_KEYS.ui, {})), filterKinds, filterPersp, filterMode, compact, fit, ultra }
    writeJson(LS_KEYS.ui, next)
  }, [filterKinds, filterPersp, filterMode, compact, fit, ultra])

  useEffect(()=>{
    const onFs = ()=> setFsRequested(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return ()=> document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Fit: bereken kolombreedte zodat alle weken passen
  useEffect(()=>{
    if(!fit){ setColWidthPx(baseCol); return }
    const calc = ()=>{
      const wrapW = wrapRef.current?.clientWidth || 0
      const avail = Math.max(0, wrapW - baseLeft - baseRight - baseRight2)
      const w = weeks.length>0 ? Math.floor(avail / weeks.length) : baseCol
      setColWidthPx(Math.max(ultra?48:56, Math.min(120, w)))
    }
    calc()
    window.addEventListener('resize', calc)
    return ()=> window.removeEventListener('resize', calc)
  }, [fit, weeks.length, baseLeft, baseRight, baseRight2, baseCol])

  // Sluit popover bij klik buiten of Escape
  useEffect(()=>{
    if(!isFilterOpen) return
    const onDown = (e: MouseEvent)=>{
      const t = e.target as Node
      if(filterPopRef.current && filterPopRef.current.contains(t)) return
      if(filterBtnRef.current && filterBtnRef.current.contains(t as Node)) return
      setIsFilterOpen(false)
    }
    const onKey = (e: KeyboardEvent)=>{ if(e.key==='Escape') setIsFilterOpen(false) }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return ()=>{ window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [isFilterOpen])

  useEffect(()=>{
    if(!isViewOpen) return
    const onDown = (e: MouseEvent)=>{
      const t = e.target as Node
      if(viewPopRef.current && viewPopRef.current.contains(t)) return
      if(viewBtnRef.current && viewBtnRef.current.contains(t as Node)) return
      setIsViewOpen(false)
    }
    const onKey = (e: KeyboardEvent)=>{ if(e.key==='Escape') setIsViewOpen(false) }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return ()=>{ window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [isViewOpen])

  const isFilterActive = (filterKinds.length>0 || filterPersp.length>0)
  // Beschikbare opties afhankelijk van de andere filter
  const availableKinds = useMemo(()=>{
    if(filterPersp.length===0) return new Set(allKinds)
    const set = new Set<string>()
    for(const a of artifactsAll){
      if(!a.kind) continue
      const ps = Array.isArray(a.perspectives)?a.perspectives:[]
      if(ps.some(p=> filterPersp.includes(String(p)))){ set.add(String(a.kind)) }
    }
    return set
  }, [artifactsAll, allKinds, filterPersp])
  const availablePersps = useMemo(()=>{
    if(filterKinds.length===0) return new Set(allPersps as string[])
    const set = new Set<string>()
    for(const a of artifactsAll){
      const k = String(a.kind||'')
      if(!k) continue
      if(filterKinds.includes(k)){
        for(const p of (Array.isArray(a.perspectives)?a.perspectives:[])) set.add(String(p))
      }
    }
    return set
  }, [artifactsAll, allPersps, filterKinds])

  const matchesFilters = (a: Artifact)=>{
    if(!isFilterActive) return true
    const kindOk = filterKinds.length===0 || filterKinds.includes(String(a.kind||''))
    const perspOk = filterPersp.length===0 || (Array.isArray(a.perspectives) && a.perspectives.some(p=> filterPersp.includes(String(p))))
    // AND tussen categorieën als beide actief zijn; anders één van beide
    if(filterKinds.length>0 && filterPersp.length>0) return kindOk && perspOk
    return kindOk && perspOk // wanneer één leeg is, is dat automatisch true
  }

  // Drag & drop verplaatsen naar andere week
  function moveArtifactToWeek(artifactId: string, newWeek: number){
    try{
      const plans = JSON.parse(localStorage.getItem(LS_KEYS.plans)||'[]') as PortfolioPlan[]
      const idx = plans.findIndex(p=> p.id===plan.id)
      if(idx>=0){
        const arts = plans[idx].artifacts||[]
        const aIdx = arts.findIndex(a=> a.id===artifactId)
        if(aIdx>=0){
          arts[aIdx] = { ...arts[aIdx], week: newWeek, updatedAt: Date.now() }
          plans[idx] = { ...plans[idx], artifacts: arts, updatedAt: Date.now() }
          localStorage.setItem(LS_KEYS.plans, JSON.stringify(plans))
          const localIdx = (plan.artifacts||[]).findIndex(a=> a.id===artifactId)
          if(localIdx>=0){ (plan.artifacts as any[])[localIdx] = { ...(plan.artifacts as any[])[localIdx], week: newWeek, updatedAt: Date.now() } }
          // forceer lokale rerender zodat verplaatsing direct zichtbaar is
          forceRerender(t=>t+1)
        }
      }
    }catch{}
  }

  // Kleurstrip per soort bewijs
  const colorForKind = (k?: string)=>{
    const key = String(k||'').toLowerCase()
    const map: Record<string,string> = {
      certificaat: '#2bb673',
      schriftelijk: '#4f7cff',
      kennistoets: '#c557c5',
      vaardigheid: '#f0a657',
      performance: '#7bd1d9',
      gesprek: '#ff6b6b',
      document: '#7986cb',
      toets: '#c557c5',
      overig: '#9aa6c6'
    }
    return map[key] || '#9aa6c6'
  }

  // Preview modal state
  const [preview, setPreview] = useState<{ title: string; artifacts: Artifact[] } | null>(null)
  function openPreview(arts: Artifact[], title: string){
    // Laat onderliggende VRAAK/Details-popups open; toon preview erboven
    setPreview({ title, artifacts: arts })
  }
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => { if(e.key==='Escape') setPreview(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Helpers for names
  const outcomeNameById = useMemo(()=>{
    const m = new Map<string,string>()
    const sanitize = (id: string, name: string)=>{
      const nm = String(name||'').trim()
      // Specifieke id-prefix (bijv. 1.2 ) verwijderen
      const exactIdRe = new RegExp('^\\s*' + id.replace('.', '\\.') + '(\\s*[-–·:.,]?\\s*)', 'i')
      // Generieke fallback (bv. 1.2, 2.10, etc.)
      const genericIdRe = /^\s*\d+\.\d+\s*[-–·:.,]?\s*/i
      let out = nm.replace(exactIdRe, '')
      if(out === nm){ out = nm.replace(genericIdRe, '') }
      return (out || nm).trim()
    }
    evlForCourse.forEach(b=> b.outcomes.forEach(o=> m.set(o.id, sanitize(o.id, o.name))))
    return m
  }, [evlForCourse])
  const caseNameById = useMemo(()=>{
    const m = new Map<string,string>()
    course?.cases.forEach(c=> m.set(c.id, c.name))
    return m
  }, [course])

  // Zelfbeheersing – lokale state voor directe rendering
  const [selfLevels, setSelfLevels] = useState<Record<string, number>>(()=> ({...((plan as any)?.selfLevels||{})}))
  useEffect(()=>{ setSelfLevels({...((plan as any)?.selfLevels||{})}) }, [plan.id])
  const updateSelfLevel = (lukId: string, val: number) => {
    setSelfLevels(cur => {
      const next = { ...cur, [lukId]: val }
      try{
        const plans = JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]')
        const idx = plans.findIndex((p:any)=>p.id===plan.id)
        const curPlan = plans[idx]
        const saved = { ...(curPlan||plan), selfLevels: next }
        if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) }
        localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans))
        ;(plan as any).selfLevels = next
      }catch{}
      return next
    })
  }

  // Kleurfunctie: 1 (rood) → 5 (groen), continu voor gemiddelden
  const colorFor = (v: number) => {
    const clamped = Math.max(1, Math.min(5, v))
    const t = (clamped - 1) / 4 // 0..1
    const hue = 0 + (120 * t) // 0=red → 120=green
    const sat = 70
    const light = 45
    return `hsl(${hue.toFixed(0)} ${sat}% ${light}%)`
  }
  const knowlNameById = useMemo(()=>{
    const m = new Map<string,string>()
    course?.knowledgeDomains.forEach(k=> m.set(k.id, k.name))
    return m
  }, [course])

  useEffect(()=>{
    const resize = () => {
      const w = tableRef.current?.scrollWidth || 0
      const visible = wrapRef.current?.clientWidth || 0
      // Spacer minimaal zichtbare breedte zodat balk altijd zichtbaar is
      setSpacerW(Math.max(w, visible))
      if(hScrollRef.current && wrapRef.current){
        hScrollRef.current.scrollLeft = wrapRef.current.scrollLeft
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [weeks.length])

  useEffect(()=>{
    let syncing = false
    const w = wrapRef.current
    const h = hScrollRef.current
    if(!w || !h) return
    const onWrap = () => {
      if(syncing) return; syncing = true; h.scrollLeft = w.scrollLeft; syncing = false
    }
    const onH = () => {
      if(syncing) return; syncing = true; w.scrollLeft = h.scrollLeft; syncing = false
    }
    w.addEventListener('scroll', onWrap, { passive: true })
    h.addEventListener('scroll', onH, { passive: true })
    return () => { w.removeEventListener('scroll', onWrap); h.removeEventListener('scroll', onH) }
  }, [spacerW])

  return (
    <>
    <div className={`wm-wrap${dragging ? ' dragging' : ''}${compact ? ' compact' : ''}${ultra ? ' ultra' : ''}`} ref={wrapRef}
      onWheel={(e)=>{
        if(!wrapRef.current) return
        if(e.shiftKey){
          e.preventDefault()
          const horizontalDelta = (e.deltaX || 0) + (e.deltaY || 0)
          wrapRef.current.scrollLeft += horizontalDelta
        }
      }}
      onPointerDown={(e)=>{
        // Niet slepen als de interactie in een popover plaatsvindt (Filter/Weergave)
        const target = e.target as HTMLElement
        if(target.closest('.wm-filter-popover')){ return }
        dragRef.current.down = true
        dragRef.current.dragging = false
        dragRef.current.lastX = e.clientX
      }}
      onPointerMove={(e)=>{
        if(!dragRef.current.down || !wrapRef.current) return
        const dx = e.clientX - dragRef.current.lastX
        if(!dragRef.current.dragging && Math.abs(dx) > 3){
          dragRef.current.dragging = true
          setDragging(true)
        }
        if(dragRef.current.dragging){
          wrapRef.current.scrollLeft -= dx
          dragRef.current.lastX = e.clientX
        }
      }}
      onPointerUp={()=>{
        dragRef.current.down = false
        if(dragRef.current.dragging){
          dragRef.current.dragging = false
          setDragging(false)
        }
      }}
      onPointerCancel={()=>{ dragRef.current.down=false; if(dragRef.current.dragging){ dragRef.current.dragging=false; setDragging(false) } }}
      onPointerLeave={()=>{ dragRef.current.down=false; if(dragRef.current.dragging){ dragRef.current.dragging=false; setDragging(false) } }}
    >
      <div ref={tableRef} className="wm-table" style={{ ['--weeks' as any]: weeks.length, ['--colWidth' as any]: `${colWidthPx}px`, ['--leftWidth' as any]: `${baseLeft}px`, ['--rightWidth' as any]: `${baseRight}px`, ['--right2Width' as any]: `${baseRight2}px` }}>
        <div className="wm-header">
          <div className="wm-corner">
            <div className="wm-corner-inner">
              <span>LUK / Week</span>
              {(()=>{
                const anyOpen = Object.values(open).some(v=>v) || openCasus || openKennis
                const toggleAll = () => {
                  const next = !anyOpen
                  setOpen(Object.fromEntries(evlForCourse.map(b=>[b.id, next])))
                  setOpenCasus(next)
                  setOpenKennis(next)
                }
                return (
                  <div style={{display:'inline-flex', gap:8}}>
                    <button className="wm-smallbtn wm-primary" onClick={toggleAll}>{anyOpen ? 'Alles inklappen' : 'Alles uitklappen'}</button>
                    <button ref={filterBtnRef} className="wm-smallbtn wm-primary" onClick={()=> {
                      const rect = filterBtnRef.current?.getBoundingClientRect()
                      setFilterTop(Math.max(8, (rect?.bottom||56) + 8))
                      setIsFilterOpen(v=>!v); setIsViewOpen(false)
                    }}>Filter</button>
                    <button ref={viewBtnRef} className="wm-smallbtn wm-primary" onClick={()=> {
                      const rect = viewBtnRef.current?.getBoundingClientRect()
                      setViewTop(Math.max(8, (rect?.bottom||56) + 8))
                      setIsViewOpen(v=>!v); setIsFilterOpen(false)
                    }}>Weergave</button>
                  </div>
                )
              })()}
            </div>
            {isFilterOpen && (
              <div ref={filterPopRef} className="wm-filter-popover" style={{ position:'fixed', left:8, right:8, top: filterTop, maxHeight: `calc(100dvh - ${filterTop + 16}px)` }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:600}}>Filter</div>
                  <button className="wm-smallbtn" onClick={()=> setIsFilterOpen(false)}>Sluiten</button>
                </div>
                <div className="wm-filter-group">
                  <div className="wm-filter-title">Soort bewijs</div>
                  <div className="wm-filter-options">
                    {allKinds.length===0 && (<span className="muted">—</span>)}
                    {allKinds.map(k => {
                      const disabled = filterPersp.length>0 && !availableKinds.has(k)
                      return (
                        <label key={k} className={`wm-filter-check${disabled?' disabled':''}`} title={disabled? 'Niet van toepassing binnen geselecteerde perspectieven':''}>
                          <input type="checkbox" disabled={disabled} checked={filterKinds.includes(k)} onChange={()=> setFilterKinds(s=> s.includes(k) ? s.filter(x=>x!==k) : [...s, k])} /> {k}
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div className="wm-filter-group">
                  <div className="wm-filter-title">Perspectieven</div>
                  <div className="wm-filter-options">
                    {allPersps.length===0 && (<span className="muted">—</span>)}
                    {allPersps.map(p => {
                      const key = String(p)
                      const disabled = filterKinds.length>0 && !availablePersps.has(key)
                      return (
                        <label key={key} className={`wm-filter-check${disabled?' disabled':''}`} title={disabled? 'Niet van toepassing binnen geselecteerde soort(en)':''}>
                          <input type="checkbox" disabled={disabled} checked={filterPersp.includes(key)} onChange={()=> setFilterPersp(s=> s.includes(key) ? s.filter(x=>x!==key) : [...s, key])} /> {key}
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div className="wm-filter-group">
                  <div className="wm-filter-title">Filteropties</div>
                  <div className="wm-filter-mode">
                    <label className="wm-filter-check">
                      <input type="radio" name="wm-hide-mode" checked={filterMode==='dim'} onChange={()=> setFilterMode('dim')} /> Niet-geselecteerd dimmen
                    </label>
                    <label className="wm-filter-check">
                      <input type="radio" name="wm-hide-mode" checked={filterMode==='hide'} onChange={()=> setFilterMode('hide')} /> Niet-geselecteerd verbergen
                    </label>
                  </div>
                  {isFilterActive && (
                    <div className="wm-filter-actions">
                      <button className="wm-smallbtn" onClick={()=>{ setFilterKinds([]); setFilterPersp([]) }}>Filters wissen</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {isViewOpen && (
              <div ref={viewPopRef} className="wm-filter-popover" style={{ position:'fixed', left:8, right:8, top: viewTop, maxHeight: `calc(100dvh - ${viewTop + 16}px)` }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:600}}>Weergave</div>
                  <button className="wm-smallbtn" onClick={()=> setIsViewOpen(false)}>Sluiten</button>
                </div>
                <div className="wm-filter-group">
                  <div className="wm-filter-title">Layout</div>
                  <div className="wm-filter-options" role="radiogroup" aria-label="Dichtheid">
                    {(()=>{
                      const density = ultra ? 'ultra' : (compact ? 'compact' : 'normal')
                      const setDensity = (v:'normal'|'compact'|'ultra')=>{
                        if(v==='normal'){ setCompact(false); setUltra(false) }
                        else if(v==='compact'){ setCompact(true); setUltra(false) }
                        else { setCompact(false); setUltra(true) }
                      }
                      return (
                        <>
                          <label className="wm-filter-check"><input type="radio" name="wm-density" checked={density==='normal'} onChange={()=> setDensity('normal')} /> Normaal</label>
                          <label className="wm-filter-check"><input type="radio" name="wm-density" checked={density==='compact'} onChange={()=> setDensity('compact')} /> Compact</label>
                          <label className="wm-filter-check"><input type="radio" name="wm-density" checked={density==='ultra'} onChange={()=> setDensity('ultra')} /> Ultracompact</label>
                        </>
                      )
                    })()}
                  </div>
                  <div className="wm-hint">Je kunt ook in- en uitzoomen met Ctrl + muiswiel.</div>
                  <div className="wm-filter-options" style={{marginTop:6}}>
                    <label className="wm-filter-check" title="Probeert alle zichtbare weken in beeld te passen. Bij smalle schermen of veel weken kan horizontale scroll toch zichtbaar blijven."><input type="checkbox" checked={fit} onChange={(e)=> setFit(e.currentTarget.checked)} /> Alle weken passend</label>
                  </div>
                  <div className="wm-hint">Op smalle schermen of bij veel lesweken kan er toch een horizontale scroll verschijnen.</div>
                </div>
                <div className="wm-filter-group">
                  <div className="wm-filter-title">Volledig scherm</div>
                  <div className="wm-filter-options">
                    <button className="wm-smallbtn wm-primary" onClick={()=>{
                      const el = document.querySelector('.center') as HTMLElement | null
                      if(!el) return
                      if(!document.fullscreenElement){ el.requestFullscreen?.() } else { document.exitFullscreen?.() }
                    }}>{fsRequested ? 'Sluit' : 'Open'} volledig scherm</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="wm-cols">
            {weeks.map(w=> {
              const y = years.find(y=>y.year===plan.year)
              const info = y?.weeks.find(ww=> ww.week===w)
              const baseCode = info?.code ? info.code : `W${w}`
              const label = info?.isHoliday ? 'vak..' : baseCode
              const titleBase = info?.isHoliday ? (info?.holidayLabel || 'Vakantie') : (info?.label || baseCode)
              const ext = info?.kind==='zero' ? ' · 0-week' : ''
              const title = info ? `${titleBase} · ${info.startISO}${info.endISO && info.endISO!==info.startISO ? ' — '+info.endISO : ''}${ext}` : baseCode
              const now = new Date()
              const start = info?.startISO ? new Date(info.startISO+'T00:00:00') : null
              const end = (info?.endISO && info.endISO!==info.startISO) ? new Date(info.endISO+'T23:59:59') : (start ? new Date(start.getTime()+6*24*3600*1000) : null)
              const isCurrent = !!(start && end && now>=start && now<=end)
              return <div key={w} className={`wm-col ${info?.isHoliday ? 'holiday':''} ${isCurrent? 'current':''}`} title={title}>{label}</div>
            })}
          </div>
          <div className="wm-vcol sticky-right offset-r2">VRAAK</div>
          <div className="wm-scol sticky-right">Beheersing</div>
        </div>
        <div className="wm-body">
          {evlForCourse.map(block => (
            <div key={block.id}>
              <div className="wm-evlhead" onClick={()=>toggleBlock(block.id)}>
                <div className="wm-rowhead evl">
                  <span className={open[block.id] ? 'caret down' : 'caret'} /> {block.id} · {block.name}
                </div>
                <div className="wm-cells" onClick={(e)=>{ if((e.target as HTMLElement).closest('.wm-chip')) e.stopPropagation() }}>
                  {weeks.map(w => {
                    const outcomeIds = block.outcomes.map(o=>o.id)
                    const list = (plan.artifacts||[]).filter(a=> a.week===w && a.evlOutcomeIds.some(id=> outcomeIds.includes(id)))
                return <div key={`evlh-${block.id}-${w}`} className="wm-cell"
                  onDragOver={(e)=>{ e.preventDefault() }}
                  onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}
                >{list.length>0 && <button className="wm-chip" onClick={(e)=>{ e.stopPropagation(); openPreview(list as any, `${block.id} · ${block.name} — ${formatLesweek(w)}`) }}>{list.length}</button>}</div>
                  })}
                </div>
                <div className="wm-vraak sticky-right offset-r2">
                  {(()=>{
                    const outcomeIds = block.outcomes.map(o=>o.id)
                    const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.evlOutcomeIds.some(id=> outcomeIds.includes(id)))
                    const bars = computeVraakBars(arts, outcomeIds)
                    const toPct = (v:number)=> `${(Math.max(1,Math.min(5,v))-1)/4*100}%`
                    return (
                      <div
                        className="vraak-bars"
                        title={[
                          'VRAAK samenvatting (V variatie, R relevantie, A authenticiteit, Ac actualiteit, K kwantiteit).',
                          'Klik voor meer details.',
                          `V:${bars.v.toFixed(1)} R:${bars.r.toFixed(1)} A:${bars.a1.toFixed(1)} Ac:${bars.a2.toFixed(1)} K:${bars.k.toFixed(1)}`
                        ].join('\n')}
                        role="button"
                        tabIndex={0}
                        onClick={(e)=>{ e.stopPropagation(); setVraakDetail({ title: `${block.id} · ${block.name}`, bars }) }}
                        onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setVraakDetail({ title: `${block.id} · ${block.name}`, bars }) } }}
                      >
                        {[['V',bars.v],['R',bars.r],['A',bars.a1],['A',bars.a2],['K',bars.k]].map(([lbl,val],i)=> (
                          <div key={i} className="bar"><div className="fill" style={{ height: toPct(val as number), background: i===0? '#5ba3ff' : i===1? '#8bd17c' : i===2? '#f0a657' : i===3? '#7bd1d9' : '#b58cff' }} /><div className="lbl">{lbl}</div></div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <div className="wm-self sticky-right">
                  {
                    (()=>{
                      const outcomeIds = block.outcomes.map(o=>o.id)
                      // Neem ook default 1 mee voor niet-ingevulde subrijen
                      const vals = outcomeIds.map(id => ( selfLevels?.[id] ?? 1 ))
                      const avg = vals.reduce((a:number,b:number)=>a+b,0)/vals.length
                      const pct = Math.max(0, Math.min(5, avg)) / 5 * 100
                      return (
                        <div className="self-tile" aria-hidden style={{ background: colorFor(avg) }}>
                          <div className="cover" style={{ width: `calc(100% - ${pct}%)` }} />
                          <button className="wm-smallbtn self-reset" onClick={(e)=>{ e.stopPropagation();
                            setSelfLevels(cur=>{ const next={...cur}; for(const id of outcomeIds) delete (next as any)[id]; try{ const plans=JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]'); const idx=plans.findIndex((p:any)=>p.id===plan.id); const curPlan=plans[idx]; const saved={...(curPlan||plan), selfLevels: next}; if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) } localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans)); (plan as any).selfLevels = next }catch{} return next })
                          }}>reset</button>
                          {/* geen numerieke weergave */}
                        </div>
                      )
                    })()
                  }
                </div>
              </div>

              {open[block.id] && block.outcomes.map(o => (
                <div key={o.id} className="wm-row">
                  {(()=>{
                    const clean = (outcomeNameById.get(o.id) || o.name || '').trim()
                    const startsWithId = new RegExp('^\\s*' + o.id.replace('.', '\\.') + '\\b', 'i').test(clean)
                    return (
                      <div className="wm-rowhead">{startsWithId ? clean : (<>{o.id} <span className="muted">{clean}</span></>)}</div>
                    )
                  })()}
                  <div className="wm-cells">
                  {weeks.map(w => {
                    const list = artifactsIn(o.id, w)
                    return (
                      <div key={w} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>
                        {list.length>0 ? (
                          <div className="wm-artlist">
                            {list.map((a:any)=> {
                              const visible = matchesFilters(a)
                              if(isFilterActive && filterMode==='hide' && !visible){ return null }
                              const faded = isFilterActive && !visible
                              return (
                              <button
                                key={a.id}
                                className={`wm-art${faded ? ' faded' : ''}`}
                                title={a.name}
                                draggable
                                onDragStart={(e)=>{ e.dataTransfer?.setData('text/plain', a.id) }}
                                data-art-id={a.id}
                                onMouseEnter={(e)=>{
                                  const btn = e.currentTarget
                                  const cell = btn.closest('.wm-cell') as HTMLElement | null
                                  if(!cell) return
                                  // plaats een placeholder om de oorspronkelijke ruimte te reserveren
                                  const ph = document.createElement('div')
                                  ph.className = 'wm-art-placeholder'
                                  ph.style.height = `${btn.offsetHeight}px`
                                  btn.after(ph)
                                  const btnRect = btn.getBoundingClientRect()
                                  const cellRect = cell.getBoundingClientRect()
                                  const topOffset = btnRect.top - cellRect.top
                                  btn.style.top = `${Math.max(4, topOffset)}px`
                                  btn.classList.add('wm-art--floating')
                                  // highlight peers (andere tegels met hetzelfde bewijs-id)
                                  const peers = document.querySelectorAll(`.wm-art[data-art-id="${a.id}"]`)
                                  peers.forEach(el=>{ if(el!==btn) (el as HTMLElement).classList.add('wm-art--peer') })
                                }}
                                onMouseLeave={(e)=>{
                                  const btn = e.currentTarget
                                  btn.classList.remove('wm-art--floating')
                                  btn.style.top = ''
                                  const next = btn.nextSibling as HTMLElement | null
                                  if(next && next.classList && next.classList.contains('wm-art-placeholder')){
                                    next.remove()
                                  }
                                  const peers = document.querySelectorAll(`.wm-art[data-art-id="${a.id}"]`)
                                  peers.forEach(el=>{ (el as HTMLElement).classList.remove('wm-art--peer') })
                                }}
                                onClick={()=> openPreview([a] as any, a.name)}
                                style={{ ['--kind-color' as any]: colorForKind(a.kind) }}
                              >
                                <div className="icons-row">
                                  <span title={String(a.kind||'')}><KindIcon kind={a.kind} /></span>
                                  <span className="sep" />
                                  {Array.isArray(a.perspectives) && a.perspectives.map((p:string)=> (
                                    <span key={p} title={p}><PerspectiveIcon p={p as any} /></span>
                                  ))}
                                </div>
                                <span className="name" title={a.name} style={{display:'inline-block', maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.name}</span>
                              </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  </div>
                  <div className="wm-vraak sticky-right offset-r2">
                    {
                      (()=>{
                        const arts = (plan.artifacts||[]).filter(a => weeks.includes(a.week) && a.evlOutcomeIds.includes(o.id))
                        const data = computeCountersData(arts)
                        const title = `${o.id} · ${(outcomeNameById.get(o.id)||'')}`.trim()
                        return (
                          <div
                            role="button"
                            tabIndex={0}
                            title={`VRAAK samenvatting van deze rij: totaal ${arts.length} bewijzen · ${data.kinds.length} soorten · ${data.persps.length} perspectieven.\nKlik voor meer details.`}
                            onClick={(e)=>{ e.stopPropagation(); setCountsDetail({ title, kinds: data.kinds, persps: data.persps, items: arts }) }}
                            onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setCountsDetail({ title, kinds: data.kinds, persps: data.persps, items: arts }) } }}
                          >
                            <div style={{display:'flex',justifyContent:'center'}}>{renderSummaryCountersFromData(data, arts.length)}</div>
                          </div>
                        )
                      })()
                    }
                  </div>
                  <div className="wm-self sticky-right">
                    {(()=>{
                      const current = Number((selfLevels?.[o.id]||0) || 0)
                      const toWidth = (v:number)=> `${Math.max(0, Math.min(5,v)) / 5 * 100}%`
                      const setVal = (v:number)=>{
                        updateSelfLevel(o.id, v)
                      }
                      const onPointer = (clientX: number, el: HTMLDivElement)=>{
                        const rect = el.getBoundingClientRect()
                        const rel = (clientX - rect.left) / rect.width
                        const clamped = Math.max(0, Math.min(1, rel))
                        const value = 1 + Math.round(clamped * 8) / 2 // 0.5 stappen tussen 1–5
                        setVal(Math.min(5, Math.max(1, value)))
                      }
                      const onDown = (e: React.PointerEvent<HTMLDivElement>)=>{
                        e.stopPropagation()
                        const el = e.currentTarget
                        if((e as any).pointerType === 'touch'){
                          const startX = e.clientX, startY = e.clientY
                          let moved = false
                          const move = (ev: PointerEvent)=>{ const dx=Math.abs(ev.clientX-startX); const dy=Math.abs(ev.clientY-startY); if(dx>10 || dy>10) moved=true }
                          const up = (ev: PointerEvent)=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); if(!moved){ onPointer(ev.clientX, el) } }
                          window.addEventListener('pointermove', move, true)
                          window.addEventListener('pointerup', up, true)
                          return
                        }
                        el.setPointerCapture?.(e.pointerId)
                        onPointer(e.clientX, el)
                        const move = (ev: PointerEvent)=>{ if(ev.buttons&1){ onPointer(ev.clientX, el) } }
                        const up = ()=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true) }
                        window.addEventListener('pointermove', move, true)
                        window.addEventListener('pointerup', up, true)
                      }
                      const onKey = (e: React.KeyboardEvent<HTMLDivElement>)=>{
                        if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ e.preventDefault(); setVal(Math.max(1, (current||1)-0.5)) }
                        if(e.key==='ArrowRight' || e.key==='ArrowUp'){ e.preventDefault(); setVal(Math.min(5, (current||1)+0.5)) }
                      }
                      return (
                        <div className="self-tile" role="slider" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current||1} tabIndex={0}
                          style={{ background: colorFor(current||1) }}
                          onPointerDown={onDown}
                          onClick={(e)=>{ e.stopPropagation(); onPointer((e as any).clientX, e.currentTarget) }}
                          onKeyDown={(e)=>{ e.stopPropagation(); onKey(e) }}
                        >
                          <div className="cover" style={{ width: `calc(100% - ${toWidth(current||1)})` }} />
                          <div className="ticks">{Array.from({length:8}).map((_,i)=>(<span key={i} />))}</div>
                          {/* geen numerieke weergave */}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Casussen sectie */}
          {(course?.cases?.length||0) > 0 && (
          <div>
              <div className="wm-evlhead" onClick={()=>setOpenCasus(v=>!v)}>
              <div className="wm-rowhead evl"><span className={openCasus ? 'caret down':'caret'} /> Casussen / Thema's</div>
              <div className="wm-cells" onClick={(e)=>{ if((e.target as HTMLElement).closest('.wm-chip')) e.stopPropagation() }}>
                {weeks.map(w => {
                  const list = (plan.artifacts||[]).filter(a=> a.week===w && a.caseIds.length>0)
                  return <div key={`cash-${w}`} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>{list.length>0 && <button className="wm-chip" onClick={()=> openPreview(list as any, `Casussen — ${formatLesweek(w)}`)}>{list.length}</button>}</div>
                })}
              </div>
              <div className="wm-vraak sticky-right offset-r2">
                {(()=>{
                  const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.caseIds.length>0)
                  const bars = computeVraakBars(arts)
                  const toPct = (v:number)=> `${(Math.max(1,Math.min(5,v))-1)/4*100}%`
                  return (
                    <div className="vraak-bars" title={`V:${bars.v.toFixed(1)} R:${bars.r.toFixed(1)} A:${bars.a1.toFixed(1)} Ac:${bars.a2.toFixed(1)} K:${bars.k.toFixed(1)}`}>
                      {[['V',bars.v],['R',bars.r],['A',bars.a1],['A',bars.a2],['K',bars.k]].map(([lbl,val],i)=> (
                        <div key={i} className="bar"><div className="fill" style={{ height: toPct(val as number), background: i===0? '#5ba3ff' : i===1? '#8bd17c' : i===2? '#f0a657' : i===3? '#7bd1d9' : '#b58cff' }} /><div className="lbl">{lbl}</div></div>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <div className="wm-self sticky-right">
                {
                  (()=>{
                    const ids = course?.cases.map(c=>c.id) || []
                    if(ids.length===0) return '—'
                    const vals = ids.map(id => ( selfLevels?.[id] ?? 1 ))
                    const avg = vals.reduce((a:number,b:number)=>a+b,0)/vals.length
                    const pct = Math.max(0, Math.min(5, avg)) / 5 * 100
                    return (
                      <div className="self-tile" aria-hidden style={{ background: colorFor(avg) }}>
                        <div className="cover" style={{ width: `calc(100% - ${pct}%)` }} />
                        <button className="wm-smallbtn self-reset" onClick={(e)=>{ e.stopPropagation();
                          setSelfLevels(cur=>{ const next={...cur}; for(const id of ids) delete (next as any)[id]; try{ const plans=JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]'); const idx=plans.findIndex((p:any)=>p.id===plan.id); const curPlan=plans[idx]; const saved={...(curPlan||plan), selfLevels: next}; if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) } localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans)); (plan as any).selfLevels = next }catch{} return next })
                        }}>reset</button>
                        {/* geen numerieke weergave */}
                      </div>
                    )
                  })()
                }
              </div>
          </div>
            {openCasus && course?.cases.map(c => (
              <div key={c.id} className="wm-row">
                <div className="wm-rowhead">{c.name}</div>
                <div className="wm-cells">
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter(a=> a.week===w && a.caseIds.includes(c.id))
                    return (
                      <div key={w} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>
                        {list.length>0 ? (
                          <div className="wm-artlist">
                            {list.map((a:any)=> {
                              const visible = matchesFilters(a)
                              if(isFilterActive && filterMode==='hide' && !visible){ return null }
                              const faded = isFilterActive && !visible
                              return (
                              <button
                                key={a.id}
                                className={`wm-art${faded ? ' faded' : ''}`}
                                title={a.name}
                                draggable
                                onDragStart={(e)=>{ e.dataTransfer?.setData('text/plain', a.id) }}
                                data-art-id={a.id}
                                onMouseEnter={(e)=>{
                                  const btn = e.currentTarget
                                  const cell = btn.closest('.wm-cell') as HTMLElement | null
                                  if(!cell) return
                                  const ph = document.createElement('div')
                                  ph.className = 'wm-art-placeholder'
                                  ph.style.height = `${btn.offsetHeight}px`
                                  btn.after(ph)
                                  const btnRect = btn.getBoundingClientRect()
                                  const cellRect = cell.getBoundingClientRect()
                                  const topOffset = btnRect.top - cellRect.top
                                  btn.style.top = `${Math.max(4, topOffset)}px`
                                  btn.classList.add('wm-art--floating')
                                  const peers = document.querySelectorAll(`.wm-art[data-art-id="${a.id}"]`)
                                  peers.forEach(el=>{ if(el!==btn) (el as HTMLElement).classList.add('wm-art--peer') })
                                }}
                                onMouseLeave={(e)=>{
                                  const btn = e.currentTarget
                                  btn.classList.remove('wm-art--floating')
                                  btn.style.top = ''
                                  const next = btn.nextSibling as HTMLElement | null
                                  if(next && (next as any).classList && next.classList.contains('wm-art-placeholder')){
                                    next.remove()
                                  }
                                  const peers = document.querySelectorAll(`.wm-art[data-art-id="${a.id}"]`)
                                  peers.forEach(el=>{ (el as HTMLElement).classList.remove('wm-art--peer') })
                                }}
                                onClick={()=> openPreview([a] as any, a.name)}
                                style={{ ['--kind-color' as any]: colorForKind(a.kind) }}
                              >
                                <div className="icons-row">
                                  <span title={String(a.kind||'')}><KindIcon kind={a.kind} /></span>
                                  <span className="sep" />
                                  {Array.isArray(a.perspectives) && a.perspectives.map((p:string)=> (
                                    <span key={p} title={p}><PerspectiveIcon p={p as any} /></span>
                                  ))}
                                </div>
                                <span className="name" title={a.name} style={{display:'inline-block', maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.name}</span>
                              </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <div className="wm-vraak sticky-right offset-r2">
                  {
                    (()=>{
                      const arts = (plan.artifacts||[]).filter(a => weeks.includes(a.week) && a.caseIds.includes(c.id))
                      const data = computeCountersData(arts)
                      const title = c.name
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          title={`VRAAK samenvatting van deze rij: totaal ${arts.length} bewijzen · ${data.kinds.length} soorten · ${data.persps.length} perspectieven.\nKlik voor meer details.`}
                          onClick={(e)=>{ e.stopPropagation(); setCountsDetail({ title, kinds: data.kinds, persps: data.persps, items: arts }) }}
                          onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setCountsDetail({ title, kinds: data.kinds, persps: data.persps, items: arts }) } }}
                        >
                          <div style={{display:'flex',justifyContent:'center'}}>{renderSummaryCountersFromData(data, arts.length)}</div>
                        </div>
                      )
                    })()
                  }
                </div>
                <div className="wm-self sticky-right">
                  {(()=>{
                    const current = Number((selfLevels?.[c.id]||0) || 0)
                    const toWidth = (v:number)=> `${Math.max(0, Math.min(5,v)) / 5 * 100}%`
                    const onPointer = (clientX: number, el: HTMLDivElement)=>{
                      const rect = el.getBoundingClientRect()
                      const rel = (clientX - rect.left) / rect.width
                      const clamped = Math.max(0, Math.min(1, rel))
                      const value = 1 + Math.round(clamped * 8) / 2 // 0.5 stappen
                      updateSelfLevel(c.id, Math.min(5, Math.max(1, value)))
                    }
                    const onDown = (e: React.PointerEvent<HTMLDivElement>)=>{
                      e.stopPropagation(); const el = e.currentTarget
                      if((e as any).pointerType === 'touch'){
                        const startX = e.clientX, startY = e.clientY
                        let moved = false
                        const move = (ev: PointerEvent)=>{ const dx=Math.abs(ev.clientX-startX); const dy=Math.abs(ev.clientY-startY); if(dx>10 || dy>10) moved=true }
                        const up = (ev: PointerEvent)=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); if(!moved){ onPointer(ev.clientX, el) } }
                        window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true)
                        return
                      }
                      el.setPointerCapture?.(e.pointerId)
                      onPointer(e.clientX, el)
                      const move = (ev: PointerEvent)=>{ if(ev.buttons&1){ onPointer(ev.clientX, el) } }
                      const up = ()=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true) }
                      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true)
                    }
                    const onKey = (e: React.KeyboardEvent<HTMLDivElement>)=>{
                      if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ e.preventDefault(); updateSelfLevel(c.id, Math.max(1, (current||1)-0.5)) }
                      if(e.key==='ArrowRight' || e.key==='ArrowUp'){ e.preventDefault(); updateSelfLevel(c.id, Math.min(5, (current||1)+0.5)) }
                    }
                    return (
                      <div className="self-tile" role="slider" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current||1} tabIndex={0}
                        style={{ background: colorFor(current||1) }}
                        onPointerDown={onDown}
                        onClick={(e)=>{ e.stopPropagation(); onPointer((e as any).clientX, e.currentTarget) }}
                        onKeyDown={(e)=>{ e.stopPropagation(); onKey(e) }}
                      >
                        <div className="cover" style={{ width: `calc(100% - ${toWidth(current||1)})` }} />
                        <div className="ticks">{Array.from({length:8}).map((_,i)=>(<span key={i} />))}</div>
                        {/* geen numerieke weergave */}
                      </div>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Kennis sectie */}
          {(course?.knowledgeDomains?.length||0) > 0 && (
          <div>
            <div className="wm-evlhead" onClick={()=>setOpenKennis(v=>!v)}>
              <div className="wm-rowhead evl"><span className={openKennis ? 'caret down':'caret'} /> Kennis</div>
              <div className="wm-cells" onClick={(e)=>{ if((e.target as HTMLElement).closest('.wm-chip')) e.stopPropagation() }}>
                {weeks.map(w => {
                  const list = (plan.artifacts||[]).filter(a=> a.week===w && a.knowledgeIds.length>0)
                  return <div key={`kenh-${w}`} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>{list.length>0 && <button className="wm-chip" onClick={()=> openPreview(list as any, `Kennis — ${formatLesweek(w)}`)}>{list.length}</button>}</div>
                })}
              </div>
              <div className="wm-vraak sticky-right offset-r2">
                {(()=>{
                  const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.knowledgeIds.length>0)
                  const bars = computeVraakBars(arts)
                  const toPct = (v:number)=> `${(Math.max(1,Math.min(5,v))-1)/4*100}%`
                  return (
                    <div className="vraak-bars" title={`V:${bars.v.toFixed(1)} R:${bars.r.toFixed(1)} A:${bars.a1.toFixed(1)} Ac:${bars.a2.toFixed(1)} K:${bars.k.toFixed(1)}`}>
                      {[['V',bars.v],['R',bars.r],['A',bars.a1],['A',bars.a2],['K',bars.k]].map(([lbl,val],i)=> (
                        <div key={i} className="bar"><div className="fill" style={{ height: toPct(val as number), background: i===0? '#5ba3ff' : i===1? '#8bd17c' : i===2? '#f0a657' : i===3? '#7bd1d9' : '#b58cff' }} /><div className="lbl">{lbl}</div></div>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <div className="wm-self sticky-right">
                {
                  (()=>{
                    const ids = course?.knowledgeDomains.map(k=>k.id) || []
                    if(ids.length===0) return '—'
                    const vals = ids.map(id => ( selfLevels?.[id] ?? 1 ))
                    const avg = vals.reduce((a:number,b:number)=>a+b,0)/vals.length
                    const pct = Math.max(0, Math.min(5, avg)) / 5 * 100
                    return (
                      <div className="self-tile" aria-hidden style={{ background: colorFor(avg) }}>
                        <div className="cover" style={{ width: `calc(100% - ${pct}%)` }} />
                        <button className="wm-smallbtn self-reset" onClick={(e)=>{ e.stopPropagation();
                          setSelfLevels(cur=>{ const next={...cur}; for(const id of ids) delete (next as any)[id]; try{ const plans=JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]'); const idx=plans.findIndex((p:any)=>p.id===plan.id); const curPlan=plans[idx]; const saved={...(curPlan||plan), selfLevels: next}; if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) } localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans)); (plan as any).selfLevels = next }catch{} return next })
                        }}>reset</button>
                        {/* geen numerieke weergave */}
                      </div>
                    )
                  })()
                }
              </div>
            </div>
            {openKennis && course?.knowledgeDomains.map(k => (
              <div key={k.id} className="wm-row">
                <div className="wm-rowhead">{k.name}</div>
                <div className="wm-cells">
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter(a=> a.week===w && a.knowledgeIds.includes(k.id))
                    return (
                      <div key={w} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>
                        {list.length>0 ? (
                          <div className="wm-artlist">
                            {list.map((a:any)=> {
                              const visible = matchesFilters(a)
                              if(isFilterActive && filterMode==='hide' && !visible){ return null }
                              const faded = isFilterActive && !visible
                              return (
                              <button
                                key={a.id}
                                className={`wm-art${faded ? ' faded' : ''}`}
                                title={a.name}
                                onClick={()=> openPreview([a] as any, a.name)}
                                draggable
                                onDragStart={(e)=>{ e.dataTransfer?.setData('text/plain', a.id) }}
                                data-art-id={a.id}
                                onMouseEnter={(e)=>{
                                  const btn = e.currentTarget
                                  const peers = document.querySelectorAll(`.wm-art[data-art-id="${a.id}"]`)
                                  peers.forEach(el=>{ if(el!==btn) (el as HTMLElement).classList.add('wm-art--peer') })
                                }}
                                onMouseLeave={()=>{
                                  const peers = document.querySelectorAll(`.wm-art[data-art-id="${a.id}"]`)
                                  peers.forEach(el=>{ (el as HTMLElement).classList.remove('wm-art--peer') })
                                }}
                                style={{ ['--kind-color' as any]: colorForKind(a.kind) }}
                              >
                                <div className="icons-row">
                                  <span title={String(a.kind||'')}><KindIcon kind={a.kind} /></span>
                                  <span className="sep" />
                                  {Array.isArray(a.perspectives) && a.perspectives.map((p:string)=> (
                                    <span key={p} title={p}><PerspectiveIcon p={p as any} /></span>
                                  ))}
                                </div>
                                <span className="name" title={a.name} style={{display:'inline-block', maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.name}</span>
                              </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <div className="wm-vraak sticky-right offset-r2">
                  {
                    (()=>{
                      const arts = (plan.artifacts||[]).filter(a => weeks.includes(a.week) && a.knowledgeIds.includes(k.id))
                      const data = computeCountersData(arts)
                      const title = k.name
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          title={`VRAAK samenvatting van deze rij: totaal ${arts.length} bewijzen · ${data.kinds.length} soorten · ${data.persps.length} perspectieven.\nKlik voor meer details.`}
                          onClick={(e)=>{ e.stopPropagation(); setCountsDetail({ title, kinds: data.kinds, persps: data.persps, items: arts }) }}
                          onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setCountsDetail({ title, kinds: data.kinds, persps: data.persps, items: arts }) } }}
                        >
                          <div style={{display:'flex',justifyContent:'center'}}>{renderSummaryCountersFromData(data, arts.length)}</div>
                        </div>
                      )
                    })()
                  }
                </div>
                <div className="wm-self sticky-right">
                  {(()=>{
                    const current = Number((selfLevels?.[k.id]||0) || 0)
                    const toWidth = (v:number)=> `${Math.max(0, Math.min(5,v)) / 5 * 100}%`
                    const onPointer = (clientX: number, el: HTMLDivElement)=>{
                      const rect = el.getBoundingClientRect()
                      const rel = (clientX - rect.left) / rect.width
                      const clamped = Math.max(0, Math.min(1, rel))
                      const value = 1 + Math.round(clamped * 8) / 2 // 0.5 stappen
                      updateSelfLevel(k.id, Math.min(5, Math.max(1, value)))
                    }
                    const onDown = (e: React.PointerEvent<HTMLDivElement>)=>{
                      e.stopPropagation(); const el = e.currentTarget
                      if((e as any).pointerType === 'touch'){
                        const startX = e.clientX, startY = e.clientY
                        let moved = false
                        const move = (ev: PointerEvent)=>{ const dx=Math.abs(ev.clientX-startX); const dy=Math.abs(ev.clientY-startY); if(dx>10 || dy>10) moved=true }
                        const up = (ev: PointerEvent)=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); if(!moved){ onPointer(ev.clientX, el) } }
                        window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true)
                        return
                      }
                      el.setPointerCapture?.(e.pointerId)
                      onPointer(e.clientX, el)
                      const move = (ev: PointerEvent)=>{ if(ev.buttons&1){ onPointer(ev.clientX, el) } }
                      const up = ()=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true) }
                      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true)
                    }
                    const onKey = (e: React.KeyboardEvent<HTMLDivElement>)=>{
                      if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ e.preventDefault(); updateSelfLevel(k.id, Math.max(1, (current||1)-0.5)) }
                      if(e.key==='ArrowRight' || e.key==='ArrowUp'){ e.preventDefault(); updateSelfLevel(k.id, Math.min(5, (current||1)+0.5)) }
                    }
                    return (
                      <div className="self-tile" role="slider" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current||1} tabIndex={0}
                        style={{ background: colorFor(current||1) }}
                        onPointerDown={onDown}
                        onClick={(e)=>{ e.stopPropagation(); onPointer((e as any).clientX, e.currentTarget) }}
                        onKeyDown={(e)=>{ e.stopPropagation(); onKey(e) }}
                      >
                        <div className="cover" style={{ width: `calc(100% - ${toWidth(current||1)})` }} />
                        <div className="ticks">{Array.from({length:8}).map((_,i)=>(<span key={i} />))}</div>
                        {/* geen numerieke weergave */}
                      </div>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
      <div className="wm-mask-left" />
      <div className="wm-hscroll sticky-bottom" ref={hScrollRef}>
        <div className="wm-hspacer" style={{ width: spacerW }} />
      </div>
    </div>
    {preview && (
      <div className="wm-preview-backdrop" style={{zIndex:3000}} onClick={()=> setPreview(null)}>
        <div className="wm-preview" onClick={(e)=> e.stopPropagation()}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
            <h3 style={{margin:'6px 0'}}>{preview!.title}</h3>
            <button className="wm-smallbtn" onClick={()=> setPreview(null)}>Sluiten</button>
          </div>
          <div style={{display:'grid', gap:12}}>
            {preview!.artifacts.map((a)=> (
              <div key={a.id} style={{border:'1px solid var(--line-strong)', borderRadius:12, padding:12, background:'var(--surface2)'}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                  <KindIcon kind={a.kind} />
                  <strong style={{flex:1}}>{a.name}</strong>
                  <span className="muted">{formatLesweek(a.week)}</span>
                </div>
                {/* iconenrij vervangen door gestructureerde info hieronder */}
                <div style={{height:4}} />
                <div className="wm-vbars">
                  <span>Relevantie</span>
                  <div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.relevantie||0)/5*100}%`}} /></div>
                  <span>Authenticiteit</span>
                  <div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.authenticiteit||0)/5*100}%`}} /></div>
                </div>
                {(()=>{ const rel=Math.max(0,Math.min(5,Number((a as any)?.vraak?.relevantie||0))); const auth=Math.max(0,Math.min(5,Number((a as any)?.vraak?.authenticiteit||0))); const base=(rel+auth)/10; const ps=Array.isArray((a as any)?.perspectives)?(a as any).perspectives as string[]:[]; const weightFor=(p:string)=>{const k=String(p||'').toLowerCase(); if(k==='zelfreflectie') return 1; if(k==='student-p'||k==='student-hf1') return 1.05; if(k==='student-hf2-3'||k==='patient') return 1.10; if(k==='docent'||k==='stagebegeleider') return 1.20; return 1}; const boost=ps.length?Math.max(...ps.map(weightFor)):1; const score01=Math.max(0,Math.min(1, base*boost)); const sizes=[10,14,18,22,28]; const selIdx=Math.min(sizes.length-1, Math.max(0, Math.round(score01*(sizes.length-1)))); const expl='Bepaald o.b.v. Relevantie en Authenticiteit; licht verhoogd bij sterker feedbackperspectief (zelfreflectie < P/HF1 < HF2/3/patiënt < docent/stagebegeleider).'; return (
                  <div style={{display:'grid', gridTemplateColumns:'100px 1fr', gap:6, alignItems:'center'}} title={`Omvang van bewijsstuk — ${(score01*100).toFixed(0)}/100\n${expl}`}>
                    <span>Omvang</span>
                    <div className="wm-puzzles" aria-label="Omvang van bewijsstuk">
                      {sizes.map((s,i)=> (<div key={i} className={`piece${i===selIdx?' sel':''}`} style={{width:s, height:s}} />))}
                    </div>
                  </div>
                )})()}
                <div style={{marginTop:10, display:'grid', gridTemplateColumns:'max-content 1fr', rowGap:8, columnGap:12}}>
                  <span className="muted">Soort</span>
                  <span>
                    {a.kind ? (
                      <span className="wm-chip" title={String(a.kind)} style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <KindIcon kind={a.kind} />
                        <span>{String(a.kind)}</span>
                      </span>
                    ) : (<span className="muted">—</span>)}
                  </span>

                  <span className="muted">EVL</span>
                  <span>
                    {(a.evlOutcomeIds && a.evlOutcomeIds.length>0) ? (
                      (()=>{
                        const uniqueIds = Array.from(new Set(a.evlOutcomeIds))
                        const groups = new Map<string, string[]>()
                        for(const id of uniqueIds){
                          const m = String(id).match(/^(\d+)/)
                          const head = m ? `EVL${m[1]}` : 'EVL?'
                          const arr = groups.get(head) || []
                          arr.push(id)
                          groups.set(head, arr)
                        }
                        // Sorteer subcodes binnen groep (1.2 < 1.10)
                        const sortSub = (ids:string[])=> ids.sort((a,b)=>{
                          const pa = a.split('.')
                          const pb = b.split('.')
                          const na = Number(pa[1]||0)
                          const nb = Number(pb[1]||0)
                          return na - nb
                        })
                        return (
                          <span style={{display:'grid', gap:4}}>
                            {Array.from(groups.entries()).sort((a,b)=> a[0].localeCompare(b[0])).map(([head, ids])=> (
                              <span key={head} style={{display:'inline-flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                                <span className="wm-chip" title={head}>{head}</span>
                                {sortSub(ids).map(id => (
                                  <span key={id} className="wm-chip" title={`${id} · ${(outcomeNameById.get(id)||'').trim()}`}>{id}</span>
                                ))}
                              </span>
                            ))}
                          </span>
                        )
                      })()
                    ) : (<span className="muted">—</span>)}
                  </span>

                  <span className="muted">Casus</span>
                  <span>
                    {(a.caseIds && a.caseIds.length>0) ? (
                      <span style={{display:'inline-flex', gap:6, flexWrap:'wrap'}}>
                        {Array.from(new Set(a.caseIds)).map(id => (
                          <span key={id} className="wm-chip" title={caseNameById.get(id)||id}>{(caseNameById.get(id)||id)}</span>
                        ))}
                      </span>
                    ) : (<span className="muted">—</span>)}
                  </span>

                  <span className="muted">Kennis</span>
                  <span>
                    {(a.knowledgeIds && a.knowledgeIds.length>0) ? (
                      <span style={{display:'inline-flex', gap:6, flexWrap:'wrap'}}>
                        {Array.from(new Set(a.knowledgeIds)).map(id => (
                          <span key={id} className="wm-chip" title={knowlNameById.get(id)||id}>{(knowlNameById.get(id)||id)}</span>
                        ))}
                      </span>
                    ) : (<span className="muted">—</span>)}
                  </span>

                  <span className="muted">Perspectieven</span>
                  <span>
                    {Array.isArray(a.perspectives) && a.perspectives.length>0 ? (
                      <span style={{display:'inline-flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                        {Array.from(new Set(a.perspectives)).map(p => {
                          const lbl = (():string=>{
                            const s = String(p||'')
                            if(s==='student-hf2-3') return 'Student HF2/3'
                            if(s==='student-hf1') return 'Student HF1'
                            if(s==='student-p') return 'Student P'
                            if(s==='zelfreflectie') return 'Zelfreflectie'
                            if(s==='stagebegeleider') return 'Stagebegeleider'
                            if(s==='patient') return 'Patiënt'
                            if(s==='docent') return 'Docent'
                            if(s==='overig') return 'Overig'
                            return s.replace(/-/g,' ')
                          })()
                          return (
                            <span key={p} className="wm-chip" title={lbl} style={{display:'inline-flex', alignItems:'center', gap:6}}>
                              <PerspectiveIcon p={p as any} />
                              <span>{lbl}</span>
                            </span>
                          )
                        })}
                      </span>
                    ) : (<span className="muted">—</span>)}
                  </span>
                </div>
                <div style={{marginTop:12, textAlign:'right'}}>
                  {onEdit && (
                    <button className="btn" onClick={()=>{ onEdit(a); setPreview(null) }}>Bewerken</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    {vraakDetail && (
      <div className="wm-preview-backdrop" onClick={()=> setVraakDetail(null)}>
        <div className="wm-preview" onClick={(e)=> e.stopPropagation()}>
          <div className="wm-modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
            <h3 style={{margin:'6px 0'}}>VRAAK – {vraakDetail.title}</h3>
            <button className="wm-smallbtn" onClick={()=> setVraakDetail(null)}>Sluiten</button>
          </div>
          <div style={{background:'rgba(255,160,0,.12)', border:'1px solid rgba(255,160,0,.4)', color:'#f0c27b', padding:8, borderRadius:8, marginBottom:10, fontSize:12}}>
            Let op: deze VRAAK‑diagram is een hulpmiddel. De scores worden berekend met eenvoudige (arbitraire) formules en deels op basis van jouw eigen zelfbeoordelingen. Gebruik ze als indicatie; beoordeel altijd holistisch en met oog voor context – de werkelijkheid is rijker dan een berekening.
          </div>
          <div style={{display:'grid', gridTemplateColumns:'minmax(220px,280px) 1fr', gap:16, alignItems:'start'}}>
            <div style={{alignSelf:'center'}}>
            <div className="vraak-bars" style={{height:240, display:'flex', alignItems:'flex-end', justifyContent:'center', gap:12, padding:'0 2px'}}>
              {(()=>{
                const bars = vraakDetail.bars as any
                const meta = (bars && (bars as any).meta) || undefined
                const toPct = (v:number)=> `${(Math.max(1,Math.min(5,v))-1)/4*100}%`
                return (
                  <>
                    {[['V',bars.v],['R',bars.r],['A',bars.a1],['A',bars.a2],['K',bars.k]].map(([lbl,val],i)=> {
                      const title = (()=>{
                        if(lbl==='V' && meta?.variation){
                          return [
                            'Variatie:',
                            '• Mix van bewijsvormen, verschillende feedbackbronnen en spreiding over tijd (begin–midden–eind).',
                            '• Hoe meer mix, hoe hoger de score.'
                          ].join('\n')
                        }
                        if(lbl==='R'){
                          const m = meta?.relevance
                          if(m?.method==='top2-avg' || m?.method==='top-2-avg'){
                            return [
                              'Relevantie:',
                              '• Per leeruitkomst nemen we je 2 hoogste relevantiesscores; is er maar één, dan telt de tweede als 1.',
                              '• De score is het gemiddelde van die 2 (1–5).'
                            ].join('\n')
                          }
                          return 'Relevantie: 2 hoogste scores, ontbrekende telt als 1; gemiddelde (1–5)'
                        }
                        if(lbl==='A' && i===2){
                          const m = meta?.authenticity
                          if(m?.method==='top2-avg'){
                            return [
                              'Authenticiteit:',
                              '• Per leeruitkomst nemen we je 2 hoogste authenticiteitsscores; is er maar één, dan telt de tweede als 1.',
                              '• De score is het gemiddelde van die 2 (1–5).'
                            ].join('\n')
                          }
                          return 'Authenticiteit: 2 hoogste scores, ontbrekende telt als 1; gemiddelde (1–5)'
                        }
                        if(lbl==='A' && i===3){
                          const m = meta?.actuality
                          if(m?.method==='top2-avg'){
                            return [
                              'Actualiteit:',
                              '• Bewijs in de lesweek = 5; <6 maanden = 4; 6–12 maanden = 4; 1–2 jaar = 3; 2–3 jaar = 2; >3 jaar = 1.',
                              '• Per leeruitkomst nemen we de 2 beste en middelen (ontbrekende telt als 1).'
                            ].join('\n')
                          }
                          return 'Actualiteit: week=5,<6m=4,6–12m=4,1–2y=3,2–3y=2,>3y=1; 2 beste gemiddeld'
                        }
                        if(lbl==='K'){
                          const m = meta?.quantity
                          if(m?.method==='adaptive-threshold'){
                            return [
                              'Kwantiteit (verzadiging):',
                              '• We kijken per leeruitkomst of je “genoeg” bewijs hebt.',
                              '• Scoor je op V, R, A en A al hoog? Dan zijn 2 sterke bewijzen vaak genoeg.',
                              '• Zijn die scores lager? Dan heb je er meer nodig (richtwaarde loopt op tot ±5).',
                              '• Je score loopt op met het aantal: 1 = weinig, 5 = verzadigd (n van T).',
                              '',
                              'Let op: genoeg bewijs betekent niet automatisch kwaliteit. Deze staaf gaat over kwantiteit/verzadiging – zijn er voldoende puzzelstukjes om de puzzel te leggen? Het zegt nog niets over wat er op de puzzel te zien is (kwaliteit).'
                            ].join('\n')
                          }
                          return 'Kwantiteit: per leeruitkomst “genoeg” bewijs; sterk → vaak 2 genoeg; zwakker → tot ±5. Let op: genoeg bewijs ≠ kwaliteit – dit zegt alleen iets over kwantiteit/verzadiging.'
                        }
                        return ''
                      })()
                      return (
                      <div key={i} className="bar" style={{height:'100%', width:22}} title={title}>
                        <div className="fill" title={title} style={{ height: toPct(val as number), background: i===0? '#5ba3ff' : i===1? '#8bd17c' : i===2? '#f0a657' : i===3? '#7bd1d9' : '#b58cff' }} />
                        <div className="lbl" title={title}>{lbl}</div>
                      </div>)
                    })}
                  </>
                )
              })()}
            </div>
            <div className="muted" style={{fontSize:12, marginTop:8, textAlign:'center'}}>Tip: beweeg met je muis over de balken voor een korte uitleg per score.</div>
            </div>
            <div style={{marginTop:0}}>
              <ul className="muted" style={{lineHeight:1.6, marginTop:0}}>
                <li><strong>V – Variatie</strong>: zorg voor een mix aan bewijsvormen (schriftelijke producten, presentaties/video/live performances, kennisbewijs), feedback vanuit verschillende perspectieven (o.a. docent, zelfreflectie, ouderejaars/peers/experts) én spreiding in tijd (vroeg/midden/laat). Wissel groepsproducten en individuele producten af.</li>
                <li><strong>R – Relevantie</strong>: laat met je bewijs de belangrijkste elementen van de leeruitkomst(en) en het thema zien. Controleer of je met je verzameling bewijs alle leeruitkomsten aantoont.</li>
                <li><strong>A – Authenticiteit</strong>: maak voor je begeleiders en beoordelaars duidelijk dat je bewijs echt is en jouw eigen ervaring en deskundigheid weerspiegelt. Sluit plagiaat uit, maak je eigen bijdrage bij groepsproducten zichtbaar en geef aan waar en hoe je AI hebt gebruikt.</li>
                <li><strong>A – Actualiteit</strong>: dit zit meestal goed omdat je bewijs in de (les)week van uitvoering toevoegt. Gebruik je ouder bewijs (bijv. bij herkansing of na een tussenperiode), geef dit dan aan en check of het nog bij het thema past.</li>
                <li><strong>K – Kwantiteit</strong>: het gaat om verzadiging: is er per leeruitkomst/subcategorie genoeg bewijs om een goed beeld te geven van waar jij staat? Is dit verzadigd, dan hoef je niet meer bewijs toe te voegen.</li>
              </ul>
              
            </div>
          </div>
        </div>
      </div>
    )}
    {countsDetail && (
      <div className="wm-preview-backdrop" onClick={()=> setCountsDetail(null)}>
        <div className="wm-preview" onClick={(e)=> e.stopPropagation()}>
          <div className="wm-modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
            <h3 style={{margin:'6px 0'}}>Details – {countsDetail.title.replace(/^.*?·\s*/, '')}</h3>
            <button className="wm-smallbtn" onClick={()=> setCountsDetail(null)}>Sluiten</button>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, margin:'6px 0 10px'}}>
            {(()=>{
              const total = (countsDetail.items||[]).length
              return renderSummaryCountersFromData({ kinds: countsDetail.kinds, persps: countsDetail.persps }, total)
            })()}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div>
              <h4 style={{margin:'6px 0'}}>Soorten bewijs</h4>
              <div className="muted" style={{marginBottom:6}}>
                {(() => {
                  const s = countsDetail.kinds.length
                  const totalByKinds = countsDetail.kinds.reduce((acc, [,c])=> acc + (c||0), 0)
                  return (<span><strong>{s}</strong> verschillende soorten · <strong>{totalByKinds}</strong> totaal</span>)
                })()}
              </div>
              <div style={{display:'grid', gap:6}}>
                {countsDetail.kinds.length===0 ? (<span className="muted">—</span>) : countsDetail.kinds.map(([k,c])=> (
                  <div key={k} style={{display:'flex', alignItems:'center', gap:8}}>
                    <KindIcon kind={k} />
                    <span style={{flex:1}}>{k}</span>
                    <strong>{c}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{margin:'6px 0'}}>Perspectieven</h4>
              <div className="muted" style={{marginBottom:6}}>
                {(() => {
                  const s = countsDetail.persps.length
                  const totalByPersp = countsDetail.persps.reduce((acc, [,c])=> acc + (c||0), 0)
                  return (<span><strong>{s}</strong> verschillende perspectieven · <strong>{totalByPersp}</strong> totaal</span>)
                })()}
              </div>
              <div style={{display:'grid', gap:6}}>
                {countsDetail.persps.length===0 ? (<span className="muted">—</span>) : countsDetail.persps.map(([p,c])=> (
                  <div key={p} style={{display:'flex', alignItems:'center', gap:8}}>
                    <PerspectiveIcon p={p as any} />
                    <span style={{flex:1}}>{p}</span>
                    <strong>{c}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{marginTop:12}}>
            <h4 style={{margin:'6px 0'}}>Bewijsstukken per lesweek</h4>
            <div className="muted" style={{marginBottom:6}}>
              {(() => { const total = (countsDetail.items||[]).length; return (<span><strong>{total}</strong> bewijzen in deze rij</span>) })()}
            </div>
            <div style={{display:'grid', gap:8}}>
              {(() => {
                const byWeek = new Map<number, Artifact[]>()
                for(const a of (countsDetail.items||[])){
                  const arr = byWeek.get(a.week) || []
                  arr.push(a)
                  byWeek.set(a.week, arr)
                }
                const entries = Array.from(byWeek.entries()).sort((a,b)=> a[0]-b[0])
                if(entries.length===0) return (<div className="muted">—</div>)
                return entries.map(([w, list]) => (
                  <div key={w} style={{border:'1px solid var(--line-strong)', borderRadius:8, padding:8, background:'var(--surface2)'}}>
                    <div style={{fontWeight:600, marginBottom:6}}>{formatLesweek(w)}</div>
                    <div style={{display:'grid', gap:6}}>
                      {list.map(a => (
                        <button key={a.id} className="wm-art" style={{['--kind-color' as any]: colorForKind(a.kind)}} onClick={()=> openPreview([a], a.name)}>
                          <div className="icons-row">
                            <span title={String(a.kind||'')}><KindIcon kind={a.kind} /></span>
                            <span className="sep" />
                            {(a.perspectives||[]).map(p => (<span key={p} title={p}><PerspectiveIcon p={p as any} /></span>))}
                          </div>
                          <div style={{display:'flex', alignItems:'center', gap:8, width:'100%', justifyContent:'space-between'}}>
                            <span className="name" title={a.name} style={{display:'inline-block', maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1}}>{a.name}</span>
                            <div className="bar" style={{position:'relative', width:14, height:36, background:'rgba(255,255,255,.10)', borderRadius:3, marginLeft:'auto'}}>
                            {(()=>{ const v=Math.max(1,Math.min(5, a.vraak?.authenticiteit||1)); const pct=((v-1)/4*100).toFixed(0)+'%';
                              const t=(v-1)/4; const hue=0+(120*t); const color=`hsl(${hue} 70% 45%)`;
                              const minPct = v<=1 ? '3%' : pct
                              return (
                                <div className="fill" style={{position:'absolute', left:0, right:0, bottom:0, height: minPct, background:color, borderRadius:3}} title={`Authenticiteit: ${v}/5`} />
                              )})()}
                          </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}


