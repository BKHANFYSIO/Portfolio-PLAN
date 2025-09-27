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

  // const rows = useMemo(()=> evlForCourse.flatMap(b => b.outcomes.map(o => ({ evlId: b.id, lukId: o.id, name: o.name }))), [evlForCourse])
  const [openCasus, setOpenCasus] = useState<boolean>(true)
  const [openKennis, setOpenKennis] = useState<boolean>(false)

  const [open, setOpen] = useState<Record<string, boolean>>(()=>Object.fromEntries(evlForCourse.map(b=>[b.id,true])))
  function toggleBlock(id: string){ setOpen(s=> ({...s, [id]: !s[id]})) }

  function artifactsIn(lukId: string, week: number){
    return (plan.artifacts||[]).filter(a => a.week===week && a.evlOutcomeIds.includes(lukId))
  }

  // removed unused kindIcon

  function averageVraak(scores: {variatie:number;relevantie:number;authenticiteit:number;actualiteit:number;kwantiteit:number}[]){
    if(scores.length===0) return '—'
    const sum = scores.reduce((a,s)=>({
      variatie:a.variatie+s.variatie,
      relevantie:a.relevantie+s.relevantie,
      authenticiteit:a.authenticiteit+s.authenticiteit,
      actualiteit:a.actualiteit+s.actualiteit,
      kwantiteit:a.kwantiteit+s.kwantiteit
    }), {variatie:0,relevantie:0,authenticiteit:0,actualiteit:0,kwantiteit:0})
    const avg = (sum.variatie+sum.relevantie+sum.authenticiteit+sum.actualiteit+sum.kwantiteit)/(scores.length*5)
    return avg.toFixed(2)
  }

  // Bereken VRAAK-balken per verzameling artifacts en (optioneel) per-subrij ids
  function computeVraakBars(arts: Artifact[], subIds?: string[]): { v:number; r:number; a1:number; a2:number; k:number }{
    const clamp = (x:number)=> Math.max(1, Math.min(5, x))
    if(!arts || arts.length===0){
      return { v:1, r:1, a1:1, a2:1, k:1 }
    }
    const unique = <T,>(arr:T[]) => Array.from(new Set(arr))
    const kinds = unique(arts.map(a=> a.kind||'overig')).length
    const persp = unique(arts.flatMap(a=> Array.isArray(a.perspectives)?a.perspectives:[])).length
    const sKinds = Math.min(1, kinds/4)
    const sPersp = Math.min(1, persp/5)
    const v = clamp(1 + 4*(0.6*sKinds + 0.4*sPersp))

    const rVals = arts.map(a=> (a.vraak?.relevantie ?? 1))
    const r = clamp(rVals.reduce((a,b)=>a+b,0)/rVals.length)

    let a1 = 1
    if(subIds && subIds.length>0){
      const perSub = subIds.map(id => {
        const inSub = arts.filter(a=> (a.evlOutcomeIds||[]).includes(id) || (a.caseIds||[]).includes(id) || (a.knowledgeIds||[]).includes(id))
        if(inSub.length===0) return 1
        return Math.max(...inSub.map(a=> (a.vraak?.authenticiteit ?? 1)))
      })
      a1 = clamp(perSub.reduce((a,b)=>a+b,0)/perSub.length)
    }else{
      const vals = arts.map(a=> (a.vraak?.authenticiteit ?? 1))
      a1 = clamp(vals.reduce((a,b)=>a+b,0)/vals.length)
    }

    const daysBetween = (ms:number)=> Math.floor((Date.now() - ms)/(24*3600*1000))
    const recencyScore = (d:number)=> (d<=90?5:d<=180?4:d<=365?3:d<=540?2:1)
    const a2 = clamp(arts.map(a=> recencyScore(daysBetween(a.createdAt||Date.now()))).reduce((a,b)=>a+b,0)/arts.length)

    const target = 5
    const k = clamp(1 + 4*Math.min(1, arts.length/target))
    return { v,r,a1,a2,k }
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
  const [isViewOpen, setIsViewOpen] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement|null>(null)
  const viewPopRef = useRef<HTMLDivElement|null>(null)
  // Weergave-instellingen
  const uiPref = readJson<Record<string, any>>(LS_KEYS.ui, {})
  const [compact, setCompact] = useState<boolean>(uiPref?.compact ?? true)
  const [fit, setFit] = useState<boolean>(uiPref?.fit ?? true)
  const [ultra, setUltra] = useState<boolean>(uiPref?.ultra ?? false)
  const [fsRequested, setFsRequested] = useState<boolean>(false)
  const baseLeft = compact ? 240 : 260
  const baseRight = compact ? 116 : 124
  const baseRight2 = compact ? 116 : 124
  const baseCol = compact ? 76 : 80
  const [colWidthPx, setColWidthPx] = useState<number>(baseCol)

  // Filter state
  const artifactsAll = (plan.artifacts||[])
  const allKinds = useMemo(()=> Array.from(new Set(artifactsAll.map(a=> String(a.kind||'').trim()).filter(Boolean))), [artifactsAll])
  const allPersps = useMemo(()=> Array.from(new Set(artifactsAll.flatMap(a=> Array.isArray(a.perspectives)?a.perspectives:[]).filter(Boolean))), [artifactsAll])
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
      setColWidthPx(Math.max(56, Math.min(120, w)))
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
                    <button ref={filterBtnRef} className="wm-smallbtn wm-primary" onClick={()=> { setIsFilterOpen(v=>!v); setIsViewOpen(false) }}>Filter</button>
                    <button ref={viewBtnRef} className="wm-smallbtn wm-primary" onClick={()=> { setIsViewOpen(v=>!v); setIsFilterOpen(false) }}>Weergave</button>
                  </div>
                )
              })()}
            </div>
            {isFilterOpen && (
              <div ref={filterPopRef} className="wm-filter-popover">
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
              <div ref={viewPopRef} className="wm-filter-popover">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:600}}>Weergave</div>
                  <button className="wm-smallbtn" onClick={()=> setIsViewOpen(false)}>Sluiten</button>
                </div>
                <div className="wm-filter-group">
                  <div className="wm-filter-title">Layout</div>
                  <div className="wm-filter-options">
                    <label className="wm-filter-check"><input type="checkbox" checked={compact} onChange={(e)=> setCompact(e.currentTarget.checked)} /> Compact</label>
                    <label className="wm-filter-check"><input type="checkbox" checked={fit} onChange={(e)=> setFit(e.currentTarget.checked)} /> Alle weken passend</label>
                    <label className="wm-filter-check"><input type="checkbox" checked={ultra} onChange={(e)=> setUltra(e.currentTarget.checked)} /> Ultracompact</label>
                  </div>
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
              return <div key={w} className={`wm-col ${info?.isHoliday ? 'holiday':''}`} title={title}>{label}</div>
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
                >{list.length>0 && <button className="wm-chip" onClick={(e)=>{ e.stopPropagation(); openPreview(list as any, `${block.id} · ${block.name} — week ${w}`) }}>{list.length}</button>}</div>
                  })}
                </div>
                <div className="wm-vraak sticky-right offset-r2">
                  {(()=>{
                    const outcomeIds = block.outcomes.map(o=>o.id)
                    const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.evlOutcomeIds.some(id=> outcomeIds.includes(id)))
                    const bars = computeVraakBars(arts, outcomeIds)
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
                      const outcomeIds = block.outcomes.map(o=>o.id)
                      // Neem ook default 1 mee voor niet-ingevulde subrijen
                      const vals = outcomeIds.map(id => ( selfLevels?.[id] ?? 1 ))
                      const avg = vals.reduce((a:number,b:number)=>a+b,0)/vals.length
                      const pct = Math.max(0, Math.min(5, avg)) / 5 * 100
                      return (
                        <div className="self-tile" aria-hidden title={`Gemiddeld: ${avg.toFixed(1)}`} style={{ background: colorFor(avg) }}>
                          <div className="cover" style={{ width: `calc(100% - ${pct}%)` }} />
                          <button className="wm-smallbtn self-reset" onClick={(e)=>{ e.stopPropagation();
                            setSelfLevels(cur=>{ const next={...cur}; for(const id of outcomeIds) delete (next as any)[id]; try{ const plans=JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]'); const idx=plans.findIndex((p:any)=>p.id===plan.id); const curPlan=plans[idx]; const saved={...(curPlan||plan), selfLevels: next}; if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) } localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans)); (plan as any).selfLevels = next }catch{} return next })
                          }}>reset</button>
                          <div className="val">{avg.toFixed(1)}</div>
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
                        return averageVraak(arts.map(a=>a.vraak))
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
                        const step = Math.min(5, Math.max(1, Math.round(rel*5)))
                        setVal(step)
                      }
                      const onDown = (e: React.PointerEvent<HTMLDivElement>)=>{
                        e.stopPropagation()
                        const el = e.currentTarget
                        el.setPointerCapture?.(e.pointerId)
                        onPointer(e.clientX, el)
                        const move = (ev: PointerEvent)=>{ if(ev.buttons&1){ onPointer(ev.clientX, el) } }
                        const up = ()=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true) }
                        window.addEventListener('pointermove', move, true)
                        window.addEventListener('pointerup', up, true)
                      }
                      const onKey = (e: React.KeyboardEvent<HTMLDivElement>)=>{
                        if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ e.preventDefault(); setVal(Math.max(1, (current||1)-1)) }
                        if(e.key==='ArrowRight' || e.key==='ArrowUp'){ e.preventDefault(); setVal(Math.min(5, (current||1)+1)) }
                      }
                      return (
                        <div className="self-tile" role="slider" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current||1} tabIndex={0}
                          style={{ background: colorFor(current||1) }}
                          onPointerDown={onDown}
                          onClick={(e)=>{ e.stopPropagation(); onPointer((e as any).clientX, e.currentTarget) }}
                          onKeyDown={(e)=>{ e.stopPropagation(); onKey(e) }}
                          title={`Beheersing: ${current||1}/5`}
                        >
                          <div className="cover" style={{ width: `calc(100% - ${toWidth(current||1)})` }} />
                          <div className="ticks">{Array.from({length:4}).map((_,i)=>(<span key={i} />))}</div>
                          <div className="val">{current||1}</div>
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
              <div className="wm-rowhead evl"><span className={openCasus ? 'caret down':'caret'} /> Casussen / Thema’s</div>
              <div className="wm-cells" onClick={(e)=>{ if((e.target as HTMLElement).closest('.wm-chip')) e.stopPropagation() }}>
                {weeks.map(w => {
                  const list = (plan.artifacts||[]).filter(a=> a.week===w && a.caseIds.length>0)
                  return <div key={`cash-${w}`} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>{list.length>0 && <button className="wm-chip" onClick={()=> openPreview(list as any, `Casussen — week ${w}`)}>{list.length}</button>}</div>
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
                      <div className="self-tile" aria-hidden title={`Gemiddeld: ${avg.toFixed(1)}`} style={{ background: colorFor(avg) }}>
                        <div className="cover" style={{ width: `calc(100% - ${pct}%)` }} />
                        <button className="wm-smallbtn self-reset" onClick={(e)=>{ e.stopPropagation();
                          setSelfLevels(cur=>{ const next={...cur}; for(const id of ids) delete (next as any)[id]; try{ const plans=JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]'); const idx=plans.findIndex((p:any)=>p.id===plan.id); const curPlan=plans[idx]; const saved={...(curPlan||plan), selfLevels: next}; if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) } localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans)); (plan as any).selfLevels = next }catch{} return next })
                        }}>reset</button>
                        <div className="val">{avg.toFixed(1)}</div>
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
                      return averageVraak(arts.map(a=>a.vraak))
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
                      const step = Math.min(5, Math.max(1, Math.round(rel*5)))
                      updateSelfLevel(c.id, step)
                    }
                    const onDown = (e: React.PointerEvent<HTMLDivElement>)=>{
                      e.stopPropagation(); const el = e.currentTarget; el.setPointerCapture?.(e.pointerId)
                      onPointer(e.clientX, el)
                      const move = (ev: PointerEvent)=>{ if(ev.buttons&1){ onPointer(ev.clientX, el) } }
                      const up = ()=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true) }
                      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true)
                    }
                    const onKey = (e: React.KeyboardEvent<HTMLDivElement>)=>{
                      if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ e.preventDefault(); updateSelfLevel(c.id, Math.max(1, (current||1)-1)) }
                      if(e.key==='ArrowRight' || e.key==='ArrowUp'){ e.preventDefault(); updateSelfLevel(c.id, Math.min(5, (current||1)+1)) }
                    }
                    return (
                      <div className="self-tile" role="slider" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current||1} tabIndex={0}
                        style={{ background: colorFor(current||1) }}
                        onPointerDown={onDown}
                        onClick={(e)=>{ e.stopPropagation(); onPointer((e as any).clientX, e.currentTarget) }}
                        onKeyDown={(e)=>{ e.stopPropagation(); onKey(e) }}
                        title={`Beheersing: ${current||1}/5`}
                      >
                        <div className="cover" style={{ width: `calc(100% - ${toWidth(current||1)})` }} />
                        <div className="ticks">{Array.from({length:4}).map((_,i)=>(<span key={i} />))}</div>
                        <div className="val">{current||1}</div>
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
                  return <div key={`kenh-${w}`} className="wm-cell" onDragOver={(e)=>{ e.preventDefault() }} onDrop={(e)=>{ const id = e.dataTransfer?.getData('text/plain'); if(id){ moveArtifactToWeek(id, w) } }}>{list.length>0 && <button className="wm-chip" onClick={()=> openPreview(list as any, `Kennis — week ${w}`)}>{list.length}</button>}</div>
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
                      <div className="self-tile" aria-hidden title={`Gemiddeld: ${avg.toFixed(1)}`} style={{ background: colorFor(avg) }}>
                        <div className="cover" style={{ width: `calc(100% - ${pct}%)` }} />
                        <button className="wm-smallbtn self-reset" onClick={(e)=>{ e.stopPropagation();
                          setSelfLevels(cur=>{ const next={...cur}; for(const id of ids) delete (next as any)[id]; try{ const plans=JSON.parse(localStorage.getItem('pf-portfolio-plans')||'[]'); const idx=plans.findIndex((p:any)=>p.id===plan.id); const curPlan=plans[idx]; const saved={...(curPlan||plan), selfLevels: next}; if(idx>=0){ plans[idx]=saved } else { plans.unshift(saved) } localStorage.setItem('pf-portfolio-plans', JSON.stringify(plans)); (plan as any).selfLevels = next }catch{} return next })
                        }}>reset</button>
                        <div className="val">{avg.toFixed(1)}</div>
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
                      return averageVraak(arts.map(a=>a.vraak))
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
                      const step = Math.min(5, Math.max(1, Math.round(rel*5)))
                      updateSelfLevel(k.id, step)
                    }
                    const onDown = (e: React.PointerEvent<HTMLDivElement>)=>{
                      e.stopPropagation(); const el = e.currentTarget; el.setPointerCapture?.(e.pointerId)
                      onPointer(e.clientX, el)
                      const move = (ev: PointerEvent)=>{ if(ev.buttons&1){ onPointer(ev.clientX, el) } }
                      const up = ()=>{ window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true) }
                      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true)
                    }
                    const onKey = (e: React.KeyboardEvent<HTMLDivElement>)=>{
                      if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ e.preventDefault(); updateSelfLevel(k.id, Math.max(1, (current||1)-1)) }
                      if(e.key==='ArrowRight' || e.key==='ArrowUp'){ e.preventDefault(); updateSelfLevel(k.id, Math.min(5, (current||1)+1)) }
                    }
                    return (
                      <div className="self-tile" role="slider" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current||1} tabIndex={0}
                        style={{ background: colorFor(current||1) }}
                        onPointerDown={onDown}
                        onClick={(e)=>{ e.stopPropagation(); onPointer((e as any).clientX, e.currentTarget) }}
                        onKeyDown={(e)=>{ e.stopPropagation(); onKey(e) }}
                        title={`Beheersing: ${current||1}/5`}
                      >
                        <div className="cover" style={{ width: `calc(100% - ${toWidth(current||1)})` }} />
                        <div className="ticks">{Array.from({length:4}).map((_,i)=>(<span key={i} />))}</div>
                        <div className="val">{current||1}</div>
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
      <div className="wm-preview-backdrop" onClick={()=> setPreview(null)}>
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
                  <span className="muted">Week {a.week}</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:8}}>
                  <span className="sep" />
                  {(a.perspectives||[]).map(p=> (<span key={p} title={p}><PerspectiveIcon p={p as any} /></span>))}
                </div>
                <div className="wm-vbars">
                  <span>Variatie</span><div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.variatie||0)/5*100}%`}} /></div>
                  <span>Relevantie</span><div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.relevantie||0)/5*100}%`}} /></div>
                  <span>Authenticiteit</span><div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.authenticiteit||0)/5*100}%`}} /></div>
                  <span>Actualiteit</span><div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.actualiteit||0)/5*100}%`}} /></div>
                  <span>Kwantiteit</span><div className="wm-vbar"><div className="fill" style={{width:`${(a.vraak?.kwantiteit||0)/5*100}%`}} /></div>
                </div>
                <div style={{marginTop:10, display:'grid', gridTemplateColumns:'max-content 1fr', rowGap:6, columnGap:10}}>
                  <span className="muted">Soort</span><span>{a.kind||'—'}</span>
                  {a.evlOutcomeIds?.length ? (<><span className="muted">EVL</span><span>{a.evlOutcomeIds.map(id=> `${id} ${outcomeNameById.get(id)||''}`).join(', ')}</span></>) : null}
                  {a.caseIds?.length ? (<><span className="muted">Casus</span><span>{a.caseIds.map(id=> caseNameById.get(id)||id).join(', ')}</span></>) : null}
                  {a.knowledgeIds?.length ? (<><span className="muted">Kennis</span><span>{a.knowledgeIds.map(id=> knowlNameById.get(id)||id).join(', ')}</span></>) : null}
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
    </>
  )
}


