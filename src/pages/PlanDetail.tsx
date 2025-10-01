import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { PortfolioPlan } from '../lib/storage'
import './planDetail.css'
import AddArtifactDialog from '../components/AddArtifactDialog'
import WeekMatrix from '../components/WeekMatrix'
import { getYears } from '../lib/curriculum'
import { KindIcon, PerspectiveIcon } from '../components/icons'
import type { PerspectiveKey } from '../lib/storage'
import type { EvidenceAgeBracket } from '../lib/storage'
import { getCurriculumForYear } from '../lib/curriculum'

export default function PlanDetail(){
  const { id } = useParams()
  const plans = readJson(LS_KEYS.plans, [] as any[])
  const plan = plans.find(p=>p.id===id)
  // verwijderde curriculum/year reads (niet nodig op deze pagina)
  const [showAdd, setShowAdd] = useState(false)
  const [localName, setLocalName] = useState(plan?.name || '')
  const [localPeriod, setLocalPeriod] = useState<PortfolioPlan['period']>(plan?.period)
  const [showList, setShowList] = useState(false)
  const [expandedEvl, setExpandedEvl] = useState<string|null>(null)
  const [outOfRangeIds, setOutOfRangeIds] = useState<string[]|null>(null)
  const [editArtifactId, setEditArtifactId] = useState<string|null>(null)
  const [editArtifactName, setEditArtifactName] = useState('')
  const [editArtifactWeek, setEditArtifactWeek] = useState<number>(1 as any)
  const [editArtifactKind, setEditArtifactKind] = useState<string>('')
  const { evl, courses } = getCurriculumForYear(plan.year)
  const course = useMemo(()=> courses.find(c=>c.id===plan.courseId), [courses, plan.courseId])
  const evlExcluded = course?.evlOverrides?.EVL1 || []
  const evlForCourse = useMemo(()=> evl.map(b => b.id==='EVL1' ? ({...b, outcomes: b.outcomes.filter(o=>!evlExcluded.includes(o.id))}) : b), [evl])
  const [editArtifactEvl, setEditArtifactEvl] = useState<string[]>([])
  const [editArtifactCases, setEditArtifactCases] = useState<string[]>([])
  const [editArtifactKnowl, setEditArtifactKnowl] = useState<string[]>([])
  const [editArtifactVraak, setEditArtifactVraak] = useState({ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 })
  const [editOccurrenceAge, setEditOccurrenceAge] = useState<EvidenceAgeBracket|''>('')
  const [editArtifactPersp, setEditArtifactPersp] = useState<PerspectiveKey[]>([])
  const [editArtifactNote, setEditArtifactNote] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showOrientation, setShowOrientation] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const swipeRef = useRef<{active:boolean; x:number; y:number}>({active:false,x:0,y:0})
  const [editForm, setEditForm] = useState({
    name: plan?.name || '',
    periodType: (plan?.period?.type as 'periode'|'semester'|'maatwerk') || 'periode',
    periodPeriode: String(plan?.period?.type==='periode' ? plan?.period?.value : 1),
    periodSemester: String(plan?.period?.type==='semester' ? plan?.period?.value : 1),
    periodStartWeek: String(plan?.period?.type==='maatwerk' ? (plan?.period?.value as number[])[0] : ''),
    periodEndWeek: String(plan?.period?.type==='maatwerk' ? (plan?.period?.value as number[])[1] : ''),
  })
  const yearWeeks = getYears().find(y=>y.year===plan.year)?.weeks || []

  // Hulpfunctie: label “Lesweek x.y · yyyy-mm-dd” voor een weeknummer
  const formatLesweek = (weekNum: number) => {
    const info = yearWeeks.find(w=> w.week===weekNum)
    if(!info) return `Week ${weekNum}`
    const base = info.code || info.label || `Week ${weekNum}`
    const prefix = info.code ? 'Lesweek ' : ''
    const date = info.startISO ? ` · ${info.startISO}` : ''
    return `${prefix}${base}${date}`
  }

  // ICS export helpers
  function toIcsDateYMD(d: Date){
    const y = d.getFullYear().toString().padStart(4,'0')
    const m = (d.getMonth()+1).toString().padStart(2,'0')
    const dd = d.getDate().toString().padStart(2,'0')
    return `${y}${m}${dd}`
  }
  function toIcsStampUTC(d: Date){
    const y = d.getUTCFullYear().toString().padStart(4,'0')
    const m = (d.getUTCMonth()+1).toString().padStart(2,'0')
    const dd = d.getUTCDate().toString().padStart(2,'0')
    const hh = d.getUTCHours().toString().padStart(2,'0')
    const mm = d.getUTCMinutes().toString().padStart(2,'0')
    const ss = d.getUTCSeconds().toString().padStart(2,'0')
    return `${y}${m}${dd}T${hh}${mm}${ss}Z`
  }
  function downloadIcsForArtifact(a: any){
    try{
      const info = yearWeeks.find(w=> w.week===a.week)
      // All-day event op startdatum van de lesweek
      const start = info?.startISO ? new Date(`${info.startISO}T00:00:00`) : new Date()
      const end = new Date(start.getTime() + 24*60*60*1000)
      const dtStart = toIcsDateYMD(start)
      const dtEnd = toIcsDateYMD(end)
      const now = new Date()
      const dtStamp = toIcsStampUTC(now)
      const summary = (a.name||'Bewijsstuk')
      const desc = [`Reminder voor bewijsstuk`, `Week: ${formatLesweek(a.week)}`, `Soort: ${a.kind||'—'}`].join(' \n ')
      const uid = `${(a.id||Math.random().toString(36).slice(2))}@jouw-portfolio`
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Jouw Portfolio//NL',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${summary.replace(/\r|\n/g,' ')}`,
        `DESCRIPTION:${desc.replace(/[\n\r]/g,' ')}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n')
      const blob = new Blob([ics], { type:'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const aTag = document.createElement('a')
      const safeName = `${summary}`.replace(/[^\w\-]+/g,'_').slice(0,80)
      aTag.href = url
      aTag.download = `${safeName || 'bewijsmoment'}.ics`
      document.body.appendChild(aTag)
      aTag.click()
      document.body.removeChild(aTag)
      URL.revokeObjectURL(url)
    }catch{}
  }

  const centerRef = useRef<HTMLElement|null>(null)

  useEffect(()=>{
    const update = ()=>{
      const isPortrait = window.matchMedia('(orientation: portrait)').matches
      const isNarrow = window.innerWidth < 1024
      setShowOrientation(isPortrait && isNarrow)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update as any)
    const onFsChange = ()=> setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return ()=>{ window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update as any); document.removeEventListener('fullscreenchange', onFsChange) }
  }, [])

  function toggleFullscreen(){
    const el = centerRef.current as HTMLElement | null
    if(!el) return
    if(!document.fullscreenElement){ el.requestFullscreen?.(); }
    else{ document.exitFullscreen?.() }
  }

  // Globale hook waarmee de matrix de add-dialoog kan openen met voorselecties
  useEffect(()=>{
    ;(window as any)._pf_openAddFromMatrix = (prefill: {week?:number; evlOutcomeId?:string; caseId?:string; knowledgeId?:string}) => {
      ;(window as any)._pf_prefill = prefill
      setShowAdd(true)
    }
    return ()=>{ if((window as any)._pf_openAddFromMatrix){ delete (window as any)._pf_openAddFromMatrix } }
  }, [])

  function getVisibleWeekNumbers(p: PortfolioPlan['period']){
    const all = yearWeeks
    if(p?.type==='periode'){
      const filtered = all.filter(w=> w.kind!=='zero')
      const startIdx = filtered.findIndex(w=> String(w.code||'')===`${p.value}.1`)
      if(startIdx===-1) return filtered.map(w=>w.week)
      const nextIdx = filtered.findIndex(w=> String(w.code||'')===`${Number(p.value)+1}.1`)
      const endIdx = nextIdx===-1 ? filtered.length : nextIdx
      return filtered.slice(startIdx, endIdx).map(w=>w.week)
    }
    if(p?.type==='semester'){
      const filtered = all.filter(w=> w.kind!=='zero')
      const idx = (label:string)=> filtered.findIndex(w=> String(w.code||'')===label)
      const p1 = idx('1.1'); const p3 = idx('3.1')
      if(p1>=0 && p3>p1){
        if(Number(p.value)===1) return filtered.slice(p1, p3).map(w=>w.week)
        return filtered.slice(p3).map(w=>w.week)
      }
      const half = Math.ceil(filtered.length/2)
      if(Number(p.value)===1) return filtered.slice(0,half).map(w=>w.week)
      return filtered.slice(half).map(w=>w.week)
    }
    if(p?.type==='maatwerk' && Array.isArray(p.value)){
      const [start,end] = p.value
      return all.filter(w=> w.week>=start && w.week<=end).map(w=>w.week)
    }
    return all.map(w=>w.week)
  }

  function periodFromEditForm(): PortfolioPlan['period']{
    if(editForm.periodType==='periode') return { type:'periode', value:Number(editForm.periodPeriode), label:`Periode ${editForm.periodPeriode}` }
    if(editForm.periodType==='semester') return { type:'semester', value:Number(editForm.periodSemester), label:`Semester ${editForm.periodSemester}` }
    if(editForm.periodType==='maatwerk') return { type:'maatwerk', value:[Number(editForm.periodStartWeek), Number(editForm.periodEndWeek)], label:`Maatwerk weeks ${editForm.periodStartWeek}-${editForm.periodEndWeek}` }
    return plan.period
  }

  // Live waarschuwing bij wijzigen van selectie in de bewerk-modal
  const [liveOutside, setLiveOutside] = useState<string[]|null>(null)
  function recomputeLiveOutside(){
    const temp = periodFromEditForm()
    const visible = new Set(getVisibleWeekNumbers(temp))
    const outside = (plan.artifacts||[] as any[]).filter((a:any)=> !visible.has(a.week)).map((a:any)=>a.id)
    setLiveOutside(outside.length ? outside : null)
  }

  function startEditArtifact(a: any){
    setEditArtifactId(a.id)
    setEditArtifactName(a.name)
    setEditArtifactWeek(a.week)
    setEditArtifactKind(a.kind||'')
    setEditArtifactEvl([...(a.evlOutcomeIds||[])])
    setEditArtifactCases([...(a.caseIds||[])])
    setEditArtifactKnowl([...(a.knowledgeIds||[])])
    setEditArtifactVraak({ ...(a.vraak||{ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 }) })
    setEditArtifactPersp([...(a.perspectives||[])])
    setEditOccurrenceAge((a.occurrenceAge as EvidenceAgeBracket)||'')
    setEditArtifactNote(String((a as any)?.note||''))
  }

  // Helper: bepaal of bewerkformulier gewijzigd is t.o.v. huidig artifact
  const isEditDirty = () => {
    if(!editArtifactId) return false
    const cur = (plan.artifacts||[]).find((a:any)=>a.id===editArtifactId)
    if(!cur) return false
    const eqArr = (a:any[]|undefined, b:any[]|undefined)=> JSON.stringify([...(a||[])].sort())===JSON.stringify([...(b||[])].sort())
    const eqObj = (a:any, b:any)=> JSON.stringify(a||{})===JSON.stringify(b||{})
    if((cur.name||'') !== (editArtifactName||'')) return true
    if(Number(cur.week||0) !== Number(editArtifactWeek||0)) return true
    if(String(cur.kind||'') !== String(editArtifactKind||'')) return true
    if(!eqArr(cur.evlOutcomeIds, editArtifactEvl)) return true
    if(!eqArr(cur.caseIds, editArtifactCases)) return true
    if(!eqArr(cur.knowledgeIds, editArtifactKnowl)) return true
    if(!eqArr(cur.perspectives||[], editArtifactPersp||[])) return true
    if(!eqObj(cur.vraak||{}, editArtifactVraak||{})) return true
    if(String((cur as any).occurrenceAge||'') !== String(editOccurrenceAge||'')) return true
    if(String((cur as any).note||'') !== String(editArtifactNote||'')) return true
    return false
  }

  // Sneltoetsen in bewerkmodal: Ctrl+S opslaan, Esc annuleren (met bevestiging bij wijzigingen)
  useEffect(()=>{
    if(!editArtifactId) return
    const onKey = (e: KeyboardEvent)=>{
      if(e.key==='s' && (e.ctrlKey||e.metaKey)){
        e.preventDefault(); saveArtifactEdits()
      }
      if(e.key==='Escape'){
        e.preventDefault(); if(!isEditDirty()|| confirm('Wijzigingen niet opgeslagen. Annuleren?')) setEditArtifactId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [editArtifactId, editArtifactName, editArtifactWeek, editArtifactKind, editArtifactEvl, editArtifactCases, editArtifactKnowl, editArtifactVraak, editArtifactPersp, editOccurrenceAge])

  function saveArtifactEdits(){
    if(!editArtifactId) return
    const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
    const idx = plans.findIndex(p=>p.id===plan.id)
    if(idx>=0){
      plans[idx] = { ...plans[idx], artifacts: plans[idx].artifacts.map((a:any)=> a.id===editArtifactId ? ({ ...a, name: editArtifactName.trim()||a.name, week: Number(editArtifactWeek), kind: editArtifactKind||undefined, perspectives: editArtifactPersp, evlOutcomeIds: editArtifactEvl, caseIds: editArtifactCases, knowledgeIds: editArtifactKnowl, vraak: editArtifactVraak, occurrenceAge: editOccurrenceAge||undefined, note: (editArtifactNote||'').trim()||undefined, updatedAt: Date.now() }) : a), updatedAt: Date.now() }
      writeJson(LS_KEYS.plans, plans)
      // update lokaal object zodat lijst ververst
      const aIdx = (plan.artifacts||[]).findIndex((a:any)=>a.id===editArtifactId)
      if(aIdx>=0){ (plan.artifacts as any[])[aIdx] = { ...(plan.artifacts as any[])[aIdx], name: editArtifactName.trim()||editArtifactName, week: Number(editArtifactWeek), kind: editArtifactKind||undefined, perspectives: editArtifactPersp, occurrenceAge: editOccurrenceAge||undefined, note: (editArtifactNote||'').trim()||undefined } }
    }
    setEditArtifactId(null)
  }

  function deleteArtifact(id: string){
    if(!confirm('Bewijsstuk verwijderen?')) return
    const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
    const idx = plans.findIndex(p=>p.id===plan.id)
    if(idx>=0){
      plans[idx] = { ...plans[idx], artifacts: plans[idx].artifacts.filter(a=> a.id!==id), updatedAt: Date.now() }
      writeJson(LS_KEYS.plans, plans)
      plan.artifacts = (plan.artifacts||[]).filter((a:any)=>a.id!==id)
    }
    if(editArtifactId===id){ setEditArtifactId(null) }
  }

  function calcRangeFromPeriode(pNum: number){
    const filtered = yearWeeks.filter(w=> w.kind!=='zero')
    const startIdx = filtered.findIndex(w=> String(w.code||'')===`${pNum}.1`)
    if(startIdx===-1){
      return { start: String(filtered[0]?.week||1), end: String(filtered[filtered.length-1]?.week||1) }
    }
    const nextIdx = filtered.findIndex(w=> String(w.code||'')===`${pNum+1}.1`)
    const endIdx = nextIdx===-1 ? filtered.length-1 : nextIdx-1
    return { start: String(filtered[startIdx].week), end: String(filtered[endIdx].week) }
  }

  function calcRangeFromSemester(sNum: number){
    const filtered = yearWeeks.filter(w=> w.kind!=='zero')
    const idx = (label:string)=> filtered.findIndex(w=> String(w.code||'')===label)
    const p1 = idx('1.1'); const p3 = idx('3.1')
    if(p1>=0 && p3>p1){
      if(sNum===1){ return { start: String(filtered[p1].week), end: String(filtered[p3-1].week) } }
      return { start: String(filtered[p3].week), end: String(filtered[filtered.length-1].week) }
    }
    // fallback halve verdeling
    const half = Math.ceil(filtered.length/2)-1
    if(sNum===1){ return { start: String(filtered[0].week), end: String(filtered[half].week) } }
    return { start: String(filtered[half+1].week), end: String(filtered[filtered.length-1].week) }
  }
  if(!plan){
    return (
      <div style={{padding:20}}>
        <p>Plan niet gevonden.</p>
        <Link to="/">Terug</Link>
      </div>
    )
  }

  // EVL/course-afleidingen gebeuren binnen WeekMatrix

  // placeholder timelineWeeks verwijderd (niet gebruikt)

  function openEdit(){
    setEditForm({
      name: localName,
      periodType: (localPeriod?.type as any) || 'periode',
      periodPeriode: String(localPeriod?.type==='periode' ? localPeriod?.value : 1),
      periodSemester: String(localPeriod?.type==='semester' ? localPeriod?.value : 1),
      periodStartWeek: String(localPeriod?.type==='maatwerk' ? (localPeriod?.value as number[])[0] : ''),
      periodEndWeek: String(localPeriod?.type==='maatwerk' ? (localPeriod?.value as number[])[1] : ''),
    })
    setShowEdit(true)
  }

  function saveEdit(){
    let nextPeriod: PortfolioPlan['period']
    if(editForm.periodType==='periode'){
      nextPeriod = { type:'periode', value:Number(editForm.periodPeriode), label:`Periode ${editForm.periodPeriode}` }
    }else if(editForm.periodType==='semester'){
      nextPeriod = { type:'semester', value:Number(editForm.periodSemester), label:`Semester ${editForm.periodSemester}` }
    }else{
      const s = Number(editForm.periodStartWeek)
      const e = Number(editForm.periodEndWeek)
      nextPeriod = { type:'maatwerk', value:[s,e], label:`Maatwerk weeks ${s}-${e}` }
    }
    const plans = readJson(LS_KEYS.plans, [] as any[])
    const idx = plans.findIndex((p:any)=>p.id===plan.id)
    if(idx>=0){
      // waarschuwing als artifacts buiten het nieuwe bereik vallen
      const visible = new Set(getVisibleWeekNumbers(nextPeriod))
      const outside = (plans[idx].artifacts||[]).filter((a:any)=> !visible.has(a.week)).map((a:any)=>a.id)
      plans[idx] = { ...plans[idx], name: editForm.name.trim() || 'Naamloos', period: nextPeriod, updatedAt: Date.now() }
      writeJson(LS_KEYS.plans, plans)
      setOutOfRangeIds(outside.length ? outside : null)
    }
    setLocalName(editForm.name.trim() || 'Naamloos')
    setLocalPeriod(nextPeriod)
    setShowEdit(false)
  }

  async function exportPdf(){
    const container = document.querySelector('.center') as HTMLElement | null
    if(!container) return
    const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' })
    const canvas = await html2canvas(container, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2 })
    const img = canvas.toDataURL('image/png')
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    const x = (pageW - w)/2, y = (pageH - h)/2
    doc.addImage(img, 'PNG', x, y, w, h)
    for(const a of (plan.artifacts||[])){
      doc.addPage('a4','landscape')
      const host = document.createElement('div')
      host.style.position = 'fixed'; host.style.left = '-10000px'; host.style.top = '0'; host.style.width = '1000px'
      document.body.appendChild(host)
      try{
        ;(window as any)._pf_setPreview?.([a], a.name)
        await new Promise(r=> setTimeout(r, 50))
        const preview = document.querySelector('.wm-preview') as HTMLElement | null
        if(preview){
          const clone = preview.cloneNode(true) as HTMLElement
          clone.style.position = 'static'; clone.style.maxHeight = 'none'; clone.style.height = 'auto'; clone.style.overflow = 'visible'
          host.appendChild(clone)
          const c2 = await html2canvas(clone, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2 })
          const img2 = c2.toDataURL('image/png')
          const r2 = Math.min(pageW / c2.width, pageH / c2.height)
          const w2 = c2.width * r2, h2 = c2.height * r2
          const x2 = (pageW - w2)/2, y2 = (pageH - h2)/2
          doc.addImage(img2, 'PNG', x2, y2, w2, h2)
        }
      }finally{
        ;(window as any)._pf_closePreview?.()
        document.body.removeChild(host)
      }
    }
    doc.save(`${localName.replace(/\s+/g,'_')}_portfolio.pdf`)
  }

  // Verwijderd auto-open via query; popup verschijnt alleen via knop

  // Instructies en varianten voor PDF-export
  const [showPdfGuide, setShowPdfGuide] = useState(false)
  async function exportPdfMatrixOnly(){
    setShowPdfGuide(false)
    const container = document.querySelector('.center') as HTMLElement | null
    if(!container) return
    const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    // Maak een offscreen clone zodat we de volledige scrollbare inhoud kunnen renderen
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.left = '-10000px'
    host.style.top = '0'
    host.style.width = `${container.clientWidth}px`
    document.body.appendChild(host)
    try{
      const clone = container.cloneNode(true) as HTMLElement
      // Zorg dat de matrix alle rijen toont (geen scroll clipping)
      const wrap = clone.querySelector('.wm-wrap') as HTMLElement | null
      if(wrap){
        wrap.style.height = 'auto'
        wrap.style.maxHeight = 'none'
        wrap.style.overflow = 'visible'
      }
      // Deactiveer sticky positionering in export om correcte paginabreek-berekening te garanderen
      const antiSticky = document.createElement('style')
      antiSticky.textContent = `
        .wm-header, .wm-corner, .wm-rowhead, .sticky-right, .sticky-bottom { position: static !important; box-shadow: none !important; }
        .wm-hscroll, .wm-mask-left { display: none !important; }
      `
      clone.appendChild(antiSticky)
      // Plaats clone in host
      host.appendChild(clone)
      await new Promise(r=> setTimeout(r, 50))

      // Bepaal mogelijke pagina-breekpunten op rijgrenzen in de clone (in CSS px)
      const breakYsCss: number[] = []
      const baseTop = clone.getBoundingClientRect().top
      clone.querySelectorAll('.wm-rowhead, .wm-evlhead').forEach(el=>{
        const rect = (el as HTMLElement).getBoundingClientRect()
        const y = Math.max(0, Math.round(rect.top - baseTop))
        if(!breakYsCss.includes(y)) breakYsCss.push(y)
      })
      // Voeg ook de ondergrens toe
      const totalHeightCss = clone.scrollHeight
      if(!breakYsCss.includes(totalHeightCss)) breakYsCss.push(totalHeightCss)
      breakYsCss.sort((a,b)=> a-b)

      // Render volledige clone naar canvas met hoge resolutie
      const big = await html2canvas(clone, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2 })

      // Converteer CSS px breekpunten naar canvas px
      const scaleY = big.height / totalHeightCss
      const breakYs = breakYsCss.map(v => Math.max(0, Math.round(v * scaleY)))

      // Bereken slice-hoogte in canvaspixels die op één PDF-pagina past
      const ratio = pageW / big.width
      const maxSlice = Math.floor(pageH / ratio)

      let yPix = 0
      let first = true
      while(yPix < big.height){
        // Zoek beste breekpunt <= yPix+maxSlice, voorkom 0-hoogte pagina's
        const limit = Math.min(big.height, yPix + maxSlice)
        const within = breakYs.filter(y=> y>yPix && y<=limit)
        let next = within.length ? within[within.length-1] : (breakYs.find(y=> y>limit) ?? big.height)
        if(next <= yPix){ next = Math.min(big.height, yPix + maxSlice) }
        const sliceH = Math.max(1, next - yPix)
        const slice = document.createElement('canvas')
        slice.width = big.width
        slice.height = sliceH
        const ctx = slice.getContext('2d')!
        ctx.drawImage(big, 0, yPix, big.width, sliceH, 0, 0, big.width, sliceH)
        const img = slice.toDataURL('image/png')
        if(!first){ doc.addPage('a4','landscape') }
        const hPt = sliceH * ratio
        doc.addImage(img, 'PNG', 0, 0, pageW, hPt)
        first = false
        yPix = next
      }

      doc.save(`${localName.replace(/\s+/g,'_')}_matrix.pdf`)
    }finally{
      document.body.removeChild(host)
    }
  }
  async function exportPdfAllArtifacts(){
    setShowPdfGuide(false)
    const addCanvasMultipage = async (doc: jsPDF, big: HTMLCanvasElement) => {
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const ratio = pageW / big.width
      const sliceH = Math.floor(pageH / ratio)
      let y = 0
      let first = true
      while(y < big.height){
        const h = Math.min(sliceH, big.height - y)
        const slice = document.createElement('canvas')
        slice.width = big.width
        slice.height = h
        const ctx = slice.getContext('2d')!
        ctx.drawImage(big, 0, y, big.width, h, 0, 0, big.width, h)
        const img = slice.toDataURL('image/png')
        if(!first){ doc.addPage('a4','portrait') }
        doc.addImage(img, 'PNG', 0, 0, pageW, h * ratio)
        first = false
        y += h
      }
    }

    // Lijst (Alle bewijsstukken) – gebruik de bestaande popup als bron, staand A4
    const doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' })
    const wasOpen = showList
    if(!wasOpen){ setShowList(true); await new Promise(r=> setTimeout(r, 350)) }
    const modalEl = (document.getElementById('all-items-modal') as HTMLElement | null) || (document.querySelector('.modal-backdrop .modal') as HTMLElement | null)
    if(modalEl){
      const clone = modalEl.cloneNode(true) as HTMLElement
      // Force volledige inhoud (geen scroll-clip)
      clone.style.position = 'static'
      clone.style.width = '820px'
      clone.style.maxHeight = 'none'
      clone.style.height = 'auto'
      clone.style.overflow = 'visible'
      const body = clone.querySelector('.modal-body') as HTMLElement | null
      if(body){ body.style.overflow = 'visible'; body.style.maxHeight = 'none'; body.style.height = 'auto' }
      // Vergroot mini EVL kolombreedte in export zodat labels als EVL1 volledig passen
      clone.querySelectorAll('.mini-evl-grid').forEach(el=>{
        (el as HTMLElement).style.setProperty('--mini-evl-colw','30px')
      })
      // PDF-fix: vervang verticale koppen door canvas-afbeeldingen voor betrouwbare rendering
      try{
        const heads = Array.from(clone.querySelectorAll('.mini-evl-colhead button')) as HTMLElement[]
        for(const btn of heads){
          const label = (btn.textContent||'').trim()
          if(!label) continue
          const canvas = document.createElement('canvas')
          // vaste maat die past binnen kolombreedte; hoogte geeft visuele marge
          const colW = 30
          const headH = 46
          canvas.width = colW
          canvas.height = headH
          const ctx = canvas.getContext('2d')!
          // achtergrond transparant, tekstkleur uit CSS variabele — fallback naar #e8ecf6
          const cssColor = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e8ecf6'
          ctx.fillStyle = cssColor
          // centreer en roteer 90° tegen de klok in
          ctx.translate(colW/2, headH/2)
          ctx.rotate(-Math.PI/2)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = '700 11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
          ctx.fillText(label, 0, 0)
          const img = document.createElement('img')
          img.src = canvas.toDataURL('image/png')
          img.style.display = 'block'
          img.style.margin = '0 auto'
          // vervang knop door afbeelding
          btn.replaceWith(img)
        }
        const styleFix = document.createElement('style')
        styleFix.textContent = `
          .mini-evl-colhead{ height: 46px !important; overflow: visible !important; display:flex; align-items:flex-end; justify-content:center; }
        `
        clone.appendChild(styleFix)
      }catch{}
      // Plaats clone offscreen voor capture
      const host = document.createElement('div')
      host.style.position = 'fixed'
      host.style.left = '-9999px'
      host.style.top = '0'
      host.appendChild(clone)
      document.body.appendChild(host)
      const canvas = await html2canvas(clone, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#111827', scale:2 })
      await addCanvasMultipage(doc, canvas)
      document.body.removeChild(host)
    }
    if(!wasOpen){ setShowList(false) }

    // Per-bewijs pagina's erachter (staand) – twee kaarten per A4 (chronologisch op week)
    {
      let yPos = Number.POSITIVE_INFINITY
      const margin = 24
      const sortedArts = [...(plan.artifacts||[] as any[])].sort((a:any,b:any)=> (a.week||0) - (b.week||0))
      for(const a of sortedArts){
        // Maak offscreen container en render 1:1 preview‑markup door de globale helper aan te roepen
        const host = document.createElement('div')
        host.style.position = 'fixed'; host.style.left = '-10000px'; host.style.top = '0'; host.style.width = '820px'
        document.body.appendChild(host)
        try{
          // Roep de preview open in de matrix als die aanwezig is
          ;(window as any)._pf_setPreview?.([a], a.name)
          await new Promise(r=> setTimeout(r, 50))
          // Zoek de actuele preview‑elementen en clone de binnenkant
          const preview = document.querySelector('.wm-preview') as HTMLElement | null
          if(preview){
            const clone = preview.cloneNode(true) as HTMLElement
            clone.style.position = 'static'; clone.style.maxHeight = 'none'; clone.style.height = 'auto'; clone.style.overflow = 'visible'
            host.appendChild(clone)
            const canvas = await html2canvas(clone, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#111827', scale:2 })
            const pageW = doc.internal.pageSize.getWidth(); const pageH = doc.internal.pageSize.getHeight()
            const maxW = pageW - margin*2
            const maxH = (pageH - margin*3) / 2 // twee per pagina
            const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1)
            const w = canvas.width * scale
            const h = canvas.height * scale
            if(yPos===Number.POSITIVE_INFINITY){ doc.addPage('a4','portrait'); yPos = margin }
            if(yPos + h > pageH - margin){ doc.addPage('a4','portrait'); yPos = margin }
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, yPos, w, h)
            yPos += h + margin
          }
        }finally{
          ;(window as any)._pf_closePreview?.()
          document.body.removeChild(host)
        }
      }
    }

    doc.save(`${localName.replace(/\s+/g,'_')}_bewijzen.pdf`)
  }

  return (
    <div className="detail">
      <header className="detail-header">
        <div>
          <h1>{localName}</h1>
          <div className="muted">{plan.year} · {plan.courseName} · {localPeriod?.label}</div>
        </div>
        <div className="actions">
          <button className="icon-btn primary actions-mobile" onClick={()=> setShowMobileMenu(true)} aria-label="Menu">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span style={{marginLeft:6}}>Menu</span>
          </button>
          <div className="actions-desktop">
          <Link className="btn" to="/">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            Terug
          </Link>
          <button className="btn" onClick={()=>setShowAdd(true)}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            Bewijsstuk toevoegen
          </button>
          <button className="btn" onClick={()=>setShowList(true)}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            Alle bewijsstukken
          </button>
          <button className="btn" onClick={()=> setShowPdfGuide(true)} title="PDF export">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 2h10l4 4v16H4z"/>
              <path d="M14 2v4h4"/>
              <path d="M7 16h2a2 2 0 0 0 0-4H7v4z"/>
              <path d="M12 12h2a2 2 0 0 1 0 4h-2v-4z"/>
              <path d="M17 12h2"/>
              <path d="M17 16h2"/>
            </svg>
            PDF
          </button>
          <button className="btn" onClick={openEdit}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
            Bewerken
          </button>
          </div>
        </div>
      </header>

      <section className="layout">
        <main className="center" ref={centerRef as any}>
          <div className="matrix-header">
            <h3>Matrix (LUK x weken)</h3>
            <button className="icon-btn primary" onClick={toggleFullscreen} title={isFullscreen? 'Sluit volledig scherm':'Volledig scherm'}>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>
              </svg>
            </button>
          </div>
          <WeekMatrix
            plan={{...plan, name: localName, period: localPeriod}}
            onEdit={(a)=>{ startEditArtifact(a as any); }}
          />
        </main>
      </section>

      {showAdd && <AddArtifactDialog plan={{...plan, name: localName}} onClose={()=>setShowAdd(false)} onSaved={()=>{}} initialWeek={(window as any)._pf_prefill?.week} initialEvlOutcomeId={(window as any)._pf_prefill?.evlOutcomeId} initialCaseId={(window as any)._pf_prefill?.caseId} initialKnowledgeId={(window as any)._pf_prefill?.knowledgeId} />}

      {showMobileMenu && (
        <div
          className="modal-backdrop"
          onClick={()=> setShowMobileMenu(false)}
          onTouchStart={(e)=>{ const t=e.touches[0]; swipeRef.current={active:true,x:t.clientX,y:t.clientY}; }}
          onTouchMove={(e)=>{ if(!swipeRef.current.active) return; const t=e.touches[0]; const dx=Math.abs(t.clientX-swipeRef.current.x); const dy=Math.abs(t.clientY-swipeRef.current.y); if(dx>80 && dx>dy){ setShowMobileMenu(false); swipeRef.current.active=false } }}
          onTouchEnd={()=>{ swipeRef.current.active=false }}
        >
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Menu</h3>
              <button className="icon-btn" aria-label="Sluiten" onClick={()=> setShowMobileMenu(false)}>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
            <div className="modal-body menu-list" style={{display:'grid', gap:8}}>
              <Link className="btn" to="/" onClick={()=> setShowMobileMenu(false)}><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg> Terug</Link>
              <button className="btn" onClick={()=>{ setShowMobileMenu(false); setShowAdd(true) }}><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Bewijsstuk toevoegen</button>
              <button className="btn" onClick={()=>{ setShowMobileMenu(false); setShowList(true) }}><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg> Alle bewijsstukken</button>
              <button className="btn" onClick={()=>{ setShowMobileMenu(false); setShowPdfGuide(true) }}><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h10l4 4v16H4z"/><path d="M14 2v4h4"/></svg> PDF</button>
              <button className="btn" onClick={()=>{ setShowMobileMenu(false); openEdit() }}><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg> Bewerken</button>
            </div>
          </div>
        </div>
      )}

      {showOrientation && (
        <div className="orientation-overlay" onClick={()=> setShowOrientation(false)}>
          <div className="orientation-panel" onClick={e=>e.stopPropagation()}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{width:24,height:24}}>
              <path d="M3 7h14v10H3z"/>
              <path d="M17 9l4 3-4 3"/>
            </svg>
            <div style={{fontWeight:600}}>Beste weergave in liggende stand</div>
            <div className="muted" style={{fontSize:12}}>Draai je toestel voor optimale bediening van de matrix.</div>
            <button className="file-label" style={{marginTop:10}} onClick={()=> setShowOrientation(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {showPdfGuide && (
        <div className="dialog-backdrop" onClick={()=>setShowPdfGuide(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>PDF export</h3>
              <button className="wm-smallbtn" onClick={()=>setShowPdfGuide(false)}>Sluiten</button>
            </div>
            <div className="muted" style={{fontSize:12, lineHeight:1.5, margin:'6px 0 12px'}}>
              Je kunt PDF’s genereren voor jezelf of voor je portfolio. Handig bij de start
              (bijv. EVL4), voor een tussenevaluatie of als bijlage bij je eindreflectie.
            </div>
            <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:600}}>PDF — Alle bewijsstukken</div>
                <div className="muted" style={{fontSize:12, lineHeight:1.5}}>
                  Je krijgt uitgebreide informatie per bewijsstuk: eerst een overzicht per week,
                  daarna een kaart per bewijsstuk in chronologische volgorde.
                </div>
                <div>
                  <button className="btn" onClick={exportPdfAllArtifacts}>PDF — Alle bewijsstukken</button>
                </div>
              </div>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:600}}>PDF — Matrix (huidige weergave)</div>
                <ul className="muted" style={{fontSize:12, margin:'0 0 0 18px'}}>
                  <li>Zoom zo dat alle lesweken zichtbaar zijn.</li>
                  <li>Past het aantal weken niet of is de tekst te klein? Maak twee exports: zoom eerst in op de eerste helft en exporteer; zoom daarna op de tweede helft en exporteer opnieuw.</li>
                </ul>
                <div>
                  <button className="btn" onClick={exportPdfMatrixOnly}>PDF — Matrix (huidige weergave)</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEdit && (
        <div className="modal-backdrop" onClick={()=>setShowEdit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Plan bewerken</h3>
              <button className="wm-smallbtn" onClick={()=>setShowEdit(false)}>Sluiten</button>
            </div>
            {liveOutside && (
              <div style={{background:'rgba(255,160,0,.12)', border:'1px solid rgba(255,160,0,.4)', color:'#f0c27b', padding:8, borderRadius:8, marginBottom:8}}>
                Let op: {liveOutside.length} bewijsstuk(ken) vallen buiten de huidige selectie.
              </div>
            )}
            {outOfRangeIds && (
              <div style={{background:'rgba(255,160,0,.12)', border:'1px solid rgba(255,160,0,.4)', color:'#f0c27b', padding:8, borderRadius:8, marginBottom:8}}>
                {outOfRangeIds.length} bewijsstuk(ken) vallen buiten het nieuwe weekbereik.
                <button className="btn" style={{marginLeft:8}} onClick={()=>{ setShowEdit(false); setShowList(true); setOutOfRangeIds(null) }}>Bekijk</button>
                <button className="file-label" style={{marginLeft:8}} onClick={()=> setOutOfRangeIds(null)}>Negeren</button>
              </div>
            )}
            <div className="grid">
              <label>
                <span>Naam</span>
                <input value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} />
              </label>
            </div>
            <fieldset>
              <legend>Periode</legend>
              <div className="radio">
                <label><input type="radio" checked={editForm.periodType==='periode'} onChange={()=>{ setEditForm({...editForm, periodType:'periode'}); setTimeout(recomputeLiveOutside,0) }}/> Periode</label>
                <label><input type="radio" checked={editForm.periodType==='semester'} onChange={()=>{ setEditForm({...editForm, periodType:'semester'}); setTimeout(recomputeLiveOutside,0) }}/> Semester</label>
                <label><input type="radio" checked={editForm.periodType==='maatwerk'} onChange={()=>{
                  // voor-invullen op basis van huidige selectie
                  let start = editForm.periodStartWeek, end = editForm.periodEndWeek
                  if(plan.period?.type==='periode'){
                    const r = calcRangeFromPeriode(Number(plan.period.value))
                    start = r.start; end = r.end
                  }else if(plan.period?.type==='semester'){
                    const r = calcRangeFromSemester(Number(plan.period.value))
                    start = r.start; end = r.end
                  }
                  setEditForm({...editForm, periodType:'maatwerk', periodStartWeek:start, periodEndWeek:end}); setTimeout(recomputeLiveOutside,0)
                }}/> Maatwerk</label>
              </div>
              {editForm.periodType==='periode' && (
                <label>
                  <span>Periode</span>
                  <select value={editForm.periodPeriode} onChange={e=>{ setEditForm({...editForm, periodPeriode:e.target.value}); setTimeout(recomputeLiveOutside,0) }}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </label>
              )}
              {editForm.periodType==='semester' && (
                <label>
                  <span>Semester</span>
                  <select value={editForm.periodSemester} onChange={e=>{ setEditForm({...editForm, periodSemester:e.target.value}); setTimeout(recomputeLiveOutside,0) }}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>
              )}
              {editForm.periodType==='maatwerk' && (
                <>
                  <div className="row2">
                    <label><span>Startweek</span>
                      <select value={editForm.periodStartWeek} onChange={e=>{ setEditForm({...editForm, periodStartWeek:e.target.value}); setTimeout(recomputeLiveOutside,0) }}>
                        {yearWeeks.map(w => (<option key={w.week} value={w.week}>{w.code||w.label}</option>))}
                      </select>
                    </label>
                    <label><span>Eindweek</span>
                      <select value={editForm.periodEndWeek} onChange={e=>{ setEditForm({...editForm, periodEndWeek:e.target.value}); setTimeout(recomputeLiveOutside,0) }}>
                        {yearWeeks.map(w => (<option key={w.week} value={w.week}>{w.code||w.label}</option>))}
                      </select>
                    </label>
                  </div>
                  <div className="muted" style={{fontSize:12}}>Tip: codes zoals 1.1, 1.2 … vak … 2.1, etc. tonen de echte lesweken (0-weken gemarkeerd als 0).</div>
                </>
              )}
            </fieldset>
            <div style={{marginTop:12, textAlign:'right'}}>
              <button className="btn" onClick={saveEdit}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
      {showList && (
        <div className="modal-backdrop" onClick={()=>setShowList(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Alle bewijsstukken</h3>
              <button className="wm-smallbtn" onClick={()=>setShowList(false)}>Sluiten</button>
            </div>
            <div className="modal-body">
            {(() => {
              const visibleSet = new Set(getVisibleWeekNumbers({ ...plan.period }))
              const outside = (plan.artifacts||[]).filter((a:any)=> !visibleSet.has(a.week))
              const weeksMap = new Map<number, any[]>()
              for(const w of yearWeeks){ weeksMap.set(w.week, []) }
              for(const a of (plan.artifacts||[] as any[])){
                if(!visibleSet.has(a.week)) continue
                const arr = weeksMap.get(a.week)
                if(arr) arr.push(a)
              }
              // Mini EVL kolommen
              const { evl } = getCurriculumForYear(plan.year)
              const evlCols = evl
              const cases = course?.cases || []
              const knowl = course?.knowledgeDomains || []
              const caseIdSet = new Set((cases||[]).map((c:any)=> c.id))
              const knowIdSet = new Set((knowl||[]).map((k:any)=> k.id))
              // Helpers om consistente codes te tonen (1.1, 1.2, …) ook als imported curriculum alleen namen heeft
              const codeFromOutcome = (evlKey: string, o: {id:string; name:string}, idx: number) => {
                const id = String(o.id||'')
                const name = String(o.name||'')
                const m1 = id.match(/^(\d+)\.(\d+)$/)
                if(m1) return `${m1[1]}.${m1[2]}`
                const m2 = name.match(/^(\d+)\.(\d+)/)
                if(m2) return `${m2[1]}.${m2[2]}`
                const evlNum = Number(String(evlKey).replace(/[^0-9]/g,''))||0
                return `${evlNum}.${idx+1}`
              }
              // Map om te bepalen bij welke EVL een outcome‑id/naam hoort (voor hoofdkolom‑markering)
              const outcomeToEvl = new Map<string, string>()
              for(const b of evlCols){
                b.outcomes.forEach((o,idx)=>{
                  const code = codeFromOutcome(b.id, o, idx)
                  outcomeToEvl.set(o.id, b.id)
                  outcomeToEvl.set(code, b.id)
                  outcomeToEvl.set(o.name, b.id)
                })
              }
              const normCode = (s: string) => {
                const m = String(s||'').match(/(\d+)\.(\d+)/)
                return m ? `${m[1]}.${m[2]}` : String(s||'').trim()
              }
              const evlIdOf = (outId: string) => {
                const direct = outcomeToEvl.get(String(outId||''))
                if(direct) return direct as any
                const m = String(outId||'').match(/^(\d+)/)
                return m ? (`EVL${m[1]}` as 'EVL1'|'EVL2'|'EVL3'|'EVL4'|'EVL5') : ('' as any)
              }
              const allCols: Array<{key:string; label:string; type:'evl'|'case'|'know'; sub?: string[]; full?: string}> = [
                ...evlCols.map(b=> ({ key:b.id, label:b.id, full:b.name, type:'evl' as const, sub: expandedEvl===b.id ? [b.id, ...b.outcomes.map((o,idx)=> codeFromOutcome(b.id, o, idx))] : undefined })),
                ...(cases.length? [{ key:'__CASE__', label:'Casus', type:'case' as const, full:'Casussen / Thema\'s', sub: expandedEvl==='__CASE__' ? ['__CASE__', ...cases.map(c=> c.id)] : undefined }]:[]),
                ...(knowl.length? [{ key:'__KNOW__', label:'Kennis', type:'know' as const, full:'Kennisdomeinen', sub: expandedEvl==='__KNOW__' ? ['__KNOW__', ...knowl.map(k=> k.id)] : undefined }]:[]),
              ]
              const colCount = allCols.reduce((n,c)=> n + (c.sub?.length||1), 0)
              const gridTemplate = `repeat(${colCount}, var(--mini-evl-colw, 24px))`
              return (
                <>
                  {outside.length>0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontWeight:600, marginBottom:6}}>Buiten geselecteerde weken</div>
                      <ul>
                        {outside.sort((a:any,b:any)=> (a as any).week - (b as any).week).map((a:any)=> (
                          <li key={a.id} style={{padding:'6px 0', display:'flex', justifyContent:'space-between', gap:8}}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                              <KindIcon kind={a.kind} /> {a.name}
                              {Array.isArray(a.perspectives) && a.perspectives.length>0 && (
                                <span style={{display:'inline-flex',alignItems:'center',gap:6, marginLeft:6}}>
                                  {a.perspectives.map((p:string)=> (<PerspectiveIcon key={p} p={p as any} />))}
                                </span>
                              )}
                            </span>
                            <span className="action-row">
                              <button className="action-icon" onClick={()=>startEditArtifact(a)} title="Bewerken" aria-label="Bewerken">
                                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
                              </button>
                              <button className="action-icon" onClick={()=> downloadIcsForArtifact(a)} title="Agenda (.ics)" aria-label="Agenda (.ics)" style={{color:'#2b8aef'}}>
                                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                                  <rect x="3" y="4" width="18" height="17" rx="2" ry="2" stroke="currentColor" fill="none" strokeWidth="2"/>
                                  <path d="M7 2v4M17 2v4M3 9h18" stroke="currentColor" fill="none" strokeWidth="2"/>
                                  <path d="M12 12v5M9.5 14.5H14.5" stroke="currentColor" fill="none" strokeWidth="2"/>
                                </svg>
                              </button>
                              <button className="action-icon" onClick={()=>deleteArtifact(a.id)} title="Verwijderen" aria-label="Verwijderen" style={{color:'#ff6b6b'}}>
                                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              <div style={{fontWeight:600, marginTop:4}}>Binnen geselecteerde weken</div>
                  <ul>
                    {yearWeeks.filter(w=> visibleSet.has(w.week)).map(w => (
                      <li key={w.week} style={{padding:'6px 0'}} className={(function(){
                        const info = yearWeeks.find(y=>y.week===w.week)
                        if(!info) return ''
                        const now = new Date()
                        const toDate = (s?:string, end?:boolean)=> s ? new Date(s + (end ? 'T23:59:59' : 'T00:00:00')) : null
                        const start = toDate(info.startISO)
                        const end = (info.endISO && info.endISO!==info.startISO) ? toDate(info.endISO, true) : (start ? new Date(start.getTime()+6*24*3600*1000) : null)
                        if(start && end && now>=start && now<=end) return 'week-current'
                        return ''
                      })()}>
                        {(()=>{ const info = yearWeeks.find(y=>y.week===w.week); const tt = info ? `${info?.label||info?.code||''} · ${info?.startISO}${info?.endISO&&info?.endISO!==info?.startISO ? ' — '+info.endISO:''}` : ''; return (
                          <div className="muted" style={{fontSize:12}} title={tt}>{w.code||w.label}</div>
                        )})()}
                        {/* week-header verwijderd; we tonen de kolomkoppen in de eerste itemrij voor perfecte uitlijning */}
                        <ul>
                      {(weeksMap.get(w.week)||[]).length>0 ? (weeksMap.get(w.week)||[]).map((a:any, idx:number) => (
                        <li key={a.id} style={{display:'grid', gridTemplateColumns:`minmax(0,1fr) auto`, alignItems:'start', gap:8}}>
                          <div style={{display:'grid', gap:2, minWidth:0}}>
                            <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
                              <span
                                className="size-dot"
                                title={(function(){
                                  const rel=Math.max(0,Math.min(5,Number((a as any)?.vraak?.relevantie||0)))
                                  const auth=Math.max(0,Math.min(5,Number((a as any)?.vraak?.authenticiteit||0)))
                                  const base=(rel+auth)/10
                                  const ps=Array.isArray((a as any)?.perspectives)?(a as any).perspectives as string[]:[]
                                  const weightFor=(p:string)=>{const k=String(p||'').toLowerCase(); if(k==='zelfreflectie') return 1; if(k==='student-p'||k==='student-hf1') return 1.05; if(k==='student-hf2-3'||k==='patient') return 1.10; if(k==='docent'||k==='stagebegeleider') return 1.20; return 1}
                                  const boost=ps.length?Math.max(...ps.map(weightFor)):1
                                  const score01=Math.max(0,Math.min(1, base*boost))
                                  return `Omvang van bewijsstuk — ${(score01*100).toFixed(0)}/100`
                                })()}
                                style={{
                                  width:(function(){
                                    const rel=Math.max(0,Math.min(5,Number((a as any)?.vraak?.relevantie||0)))
                                    const auth=Math.max(0,Math.min(5,Number((a as any)?.vraak?.authenticiteit||0)))
                                    const base=(rel+auth)/10
                                    const ps=Array.isArray((a as any)?.perspectives)?(a as any).perspectives as string[]:[]
                                    const weightFor=(p:string)=>{const k=String(p||'').toLowerCase(); if(k==='zelfreflectie') return 1; if(k==='student-p'||k==='student-hf1') return 1.05; if(k==='student-hf2-3'||k==='patient') return 1.10; if(k==='docent'||k==='stagebegeleider') return 1.20; return 1}
                                    const boost=ps.length?Math.max(...ps.map(weightFor)):1
                                    const score01=Math.max(0,Math.min(1, base*boost))
                                    const sizes=[10,14,18,22,28]
                                    const selIdx=Math.min(sizes.length-1, Math.max(0, Math.round(score01*(sizes.length-1))))
                                    return sizes[selIdx]
                                  })(),
                                  height:(function(){
                                    const rel=Math.max(0,Math.min(5,Number((a as any)?.vraak?.relevantie||0)))
                                    const auth=Math.max(0,Math.min(5,Number((a as any)?.vraak?.authenticiteit||0)))
                                    const base=(rel+auth)/10
                                    const ps=Array.isArray((a as any)?.perspectives)?(a as any).perspectives as string[]:[]
                                    const weightFor=(p:string)=>{const k=String(p||'').toLowerCase(); if(k==='zelfreflectie') return 1; if(k==='student-p'||k==='student-hf1') return 1.05; if(k==='student-hf2-3'||k==='patient') return 1.10; if(k==='docent'||k==='stagebegeleider') return 1.20; return 1}
                                    const boost=ps.length?Math.max(...ps.map(weightFor)):1
                                    const score01=Math.max(0,Math.min(1, base*boost))
                                    const sizes=[10,14,18,22,28]
                                    const selIdx=Math.min(sizes.length-1, Math.max(0, Math.round(score01*(sizes.length-1))))
                                    return sizes[selIdx]
                                  })(),
                                  background:'#a78bfa',
                                  boxShadow:'0 0 0 2px rgba(167,139,250,.35)',
                                  flex:'0 0 auto',
                                  marginLeft:-14
                                }}
                              />
                              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a.name}</span>
                            </div>
                            <div style={{display:'inline-flex',alignItems:'center',gap:8, minWidth:0, paddingLeft:18}}>
                              <span title={String(a.kind||'')} style={{display:'inline-flex',alignItems:'center',gap:4}}>
                                <KindIcon kind={a.kind} />
                              </span>
                              <span className="muted" aria-hidden>|</span>
                              {Array.isArray(a.perspectives) && a.perspectives.slice(0,3).map((p:string)=> (
                                <span key={p} title={p}><PerspectiveIcon p={p as any} /></span>
                              ))}
                              {Array.isArray(a.perspectives) && a.perspectives.length>3 && (
                                <span className="muted" style={{fontSize:10}}>+{a.perspectives.length-3}</span>
                              )}
                            </div>
                          </div>
                          <div className="mini-evl-grid" style={{gridTemplateColumns:`${gridTemplate} auto`, ['--mini-evl-colw' as any]:'24px', alignSelf:'start', marginTop: (idx===0 ? -26 : 0)}}>
                            {idx===0 && (
                              <div className="mini-evl-header" style={{gridTemplateColumns: gridTemplate, gridColumn: `1 / span ${colCount}`, gridRow:1}}>
                                {allCols.map(col=> (
                                  col.sub && col.sub.length>0 ? (
                                    col.sub.map((sid) => {
                                      const head = sid===col.key
                                      let text = head ? col.label : sid
                                      let tt = head ? (col.full||col.label) : sid
                                      if(col.type==='evl' && !head){
                                        const ev = evlCols.find(e=>e.id===col.key as any)
                                        const idxMatch = ev ? ev.outcomes.findIndex((o,idx)=> codeFromOutcome(ev.id, o, idx)===sid) : -1
                                        const name = (idxMatch>=0 && ev) ? ev.outcomes[idxMatch].name : ''
                                        tt = name ? `${sid} · ${name}` : sid
                                        text = sid
                                      }
                                      if(col.type==='case' && !head){
                                        const idxIn = cases.findIndex(c=> c.id===sid)
                                        const nm = cases[idxIn]?.name||''
                                        tt = nm || sid
                                        text = (nm || sid).slice(0,4)
                                      }
                                      if(col.type==='know' && !head){
                                        const idxIn = knowl.findIndex(k=> k.id===sid)
                                        const nm = knowl[idxIn]?.name||''
                                        tt = nm || sid
                                        text = (nm || sid).slice(0,4)
                                      }
                                      const lvlClass = col.type==='evl' ? (col.key==='EVL1' ? 'lvl-evl1' : col.key==='EVL2' ? 'lvl-evl2' : col.key==='EVL3' ? 'lvl-evl3' : col.key==='EVL4' ? 'lvl-evl4' : 'lvl-evl5') : (col.type==='case' ? 'lvl-case' : 'lvl-know')
                                      return (
                                        <div key={`wh-${w.week}-${col.key}-${sid}`} className={`mini-evl-colhead${head?' head':' sub'} ${lvlClass}`} title={tt}>
                                          <button title={tt} onClick={()=> setExpandedEvl(prev=> prev===col.key? null : col.key)}>{text}</button>
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <div key={`wh-${w.week}-${col.key}`} className="mini-evl-colhead" title={col.full||col.label}><button onClick={()=> setExpandedEvl(prev=> prev===col.key? null : col.key)}>{col.label}</button></div>
                                  )
                                ))}
                              </div>
                            )}
                            <div className="mini-evl-row" style={{gridTemplateColumns: gridTemplate, gridColumn: `1 / span ${colCount}`, gridRow: idx===0? 2: 1}} onClick={(e)=>{
                              const target = e.target as HTMLElement
                              const cell = target.closest('.mini-evl-cell') as HTMLElement | null
                              if(!cell) return
                              const rowEl = cell.parentElement
                              if(!rowEl) return
                              const cells = Array.from(rowEl.children).filter(el=> el.classList.contains('mini-evl-cell'))
                              const idxCell = cells.indexOf(cell)
                              let acc = 0
                              for(const meta of allCols){
                                const span = (meta.sub && meta.sub.length>0) ? meta.sub.length : 1
                                if(idxCell>=acc && idxCell<acc+span){ setExpandedEvl(prev=> prev===meta.key? null : meta.key); break }
                                acc += span
                              }
                            }}>
                                {allCols.map(col=> {
                                  if(col.type==='evl'){
                                    if(col.sub && col.sub.length>0){
                                      return col.sub.map(sid => {
                                        if(sid===col.key){
                                          const hasHead = (a.evlOutcomeIds||[]).some((id:string)=> evlIdOf(id)===col.key || normCode(id).startsWith(String(col.key).replace(/\D/g,'')+'.'))
                                          const isSelected = expandedEvl===col.key
                                          return <div key={`c-${a.id}-${col.key}-head`} className={`mini-evl-cell head${hasHead?' mark':''}${isSelected?' selected':''}`} />
                                        }
                                        const normIds = (a.evlOutcomeIds||[]).map(normCode)
                                        const mark = normIds.includes(normCode(sid))
                                        const lvlClass = col.type==='evl' ? (col.key==='EVL1' ? 'lvl-evl1' : col.key==='EVL2' ? 'lvl-evl2' : col.key==='EVL3' ? 'lvl-evl3' : col.key==='EVL4' ? 'lvl-evl4' : 'lvl-evl5') : (col.type==='case' ? 'lvl-case' : 'lvl-know')
                                        return <div key={`c-${a.id}-${col.key}-${sid}`} className={`mini-evl-cell sub ${lvlClass}${mark?' submark':''}`} />
                                      })
                                    }
                                    // hoofdkolom markeren als er één of meer subcategorieën zijn aangevinkt
                                    const has = (a.evlOutcomeIds||[]).some((id:string)=> evlIdOf(id)===col.key || normCode(id).startsWith(String(col.key).replace(/\D/g,'')+'.'))
                                    return <div key={`c-${a.id}-${col.key}`} className={`mini-evl-cell head${has?' mark':''}`} />
                                  }
                                  if(col.type==='case'){
                                    if(col.sub && col.sub.length>0){
                                      const lvlClass = 'lvl-case'
                                      return col.sub.map(sid => {
                                        if(sid===col.key){
                                          const hasAny = (a.caseIds||[]).some((id:string)=> caseIdSet.has(id))
                                          return <div key={`c-${a.id}-case-head`} className={`mini-evl-cell head ${lvlClass}${hasAny?' mark':''}`} title="Casus/Thema" />
                                        }
                                        const mark = (a.caseIds||[]).includes(sid)
                                        return <div key={`c-${a.id}-case-${sid}`} className={`mini-evl-cell sub ${lvlClass}${mark?' submark':''}`} title="Casus/Thema" />
                                      })
                                    }
                                    const has = (a.caseIds||[]).some((id:string)=> caseIdSet.has(id))
                                    return <div key={`c-${a.id}-case`} className={`mini-evl-cell${has?' mark':''}`} title="Casus/Thema" />
                                  }
                                  if(col.type==='know'){
                                    if(col.sub && col.sub.length>0){
                                      const lvlClass = 'lvl-know'
                                      return col.sub.map(sid => {
                                        if(sid===col.key){
                                          const hasAny = (a.knowledgeIds||[]).some((id:string)=> knowIdSet.has(id))
                                          return <div key={`c-${a.id}-know-head`} className={`mini-evl-cell head ${lvlClass}${hasAny?' mark':''}`} title="Kennis" />
                                        }
                                        const mark = (a.knowledgeIds||[]).includes(sid)
                                        return <div key={`c-${a.id}-know-${sid}`} className={`mini-evl-cell sub ${lvlClass}${mark?' submark':''}`} title="Kennis" />
                                      })
                                    }
                                    const has = (a.knowledgeIds||[]).some((id:string)=> knowIdSet.has(id))
                                    return <div key={`c-${a.id}-know`} className={`mini-evl-cell${has?' mark':''}`} title="Kennis" />
                                  }
                                })}
                            </div>
                            <span className="action-row" style={{justifySelf:'end', gridColumn: colCount+1, gridRow: idx===0? 2: 1}}>
                              <button className="action-icon" onClick={()=>startEditArtifact(a)} title="Bewerken" aria-label="Bewerken">
                                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
                              </button>
                              <button className="action-icon" onClick={()=> downloadIcsForArtifact(a)} title="Agenda (.ics)" aria-label="Agenda (.ics)" style={{color:'#2b8aef'}}>
                                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                                  <rect x="3" y="4" width="18" height="17" rx="2" ry="2" stroke="currentColor" fill="none" strokeWidth="2"/>
                                  <path d="M7 2v4M17 2v4M3 9h18" stroke="currentColor" fill="none" strokeWidth="2"/>
                                  <path d="M12 12v5M9.5 14.5H14.5" stroke="currentColor" fill="none" strokeWidth="2"/>
                                </svg>
                              </button>
                              <button className="action-icon" onClick={()=>deleteArtifact(a.id)} title="Verwijderen" aria-label="Verwijderen" style={{color:'#ff6b6b'}}>
                                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
                              </button>
                            </span>
                          </div>
                        </li>
                          )) : (
                            <li className="muted">—</li>
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              )
            })()}
            </div>
          </div>
        </div>
      )}

      {showPdfGuide && (
        <div className="dialog-backdrop" onClick={()=>setShowPdfGuide(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>PDF export</h3>
              <button className="wm-smallbtn" onClick={()=>setShowPdfGuide(false)}>Sluiten</button>
            </div>
            <div className="muted" style={{fontSize:12, lineHeight:1.5, margin:'6px 0 12px'}}>
              Je kunt PDF’s genereren voor jezelf of voor je portfolio. Handig bij de start
              (bijv. EVL4), voor een tussenevaluatie of als bijlage bij je eindreflectie.
            </div>
            <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:600}}>PDF — Alle bewijsstukken</div>
                <div className="muted" style={{fontSize:12, lineHeight:1.5}}>
                  Je krijgt uitgebreide informatie per bewijsstuk: eerst een overzicht per week,
                  daarna een kaart per bewijsstuk in chronologische volgorde.
                </div>
                <div>
                  <button className="btn" onClick={exportPdfAllArtifacts}>PDF — Alle bewijsstukken</button>
                </div>
              </div>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:600}}>PDF — Matrix (huidige weergave)</div>
                <ul className="muted" style={{fontSize:12, margin:'0 0 0 18px'}}>
                  <li>Zoom zo dat alle lesweken zichtbaar zijn.</li>
                  <li>Past het aantal weken niet of is de tekst te klein? Maak twee exports: zoom eerst in op de eerste helft en exporteer; zoom daarna op de tweede helft en exporteer opnieuw.</li>
                </ul>
                <div>
                  <button className="btn" onClick={exportPdfMatrixOnly}>PDF — Matrix (huidige weergave)</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editArtifactId && (
        <div className="modal-backdrop" onClick={()=>{ if(!isEditDirty() || confirm('Wijzigingen niet opgeslagen. Annuleren?')) setEditArtifactId(null) }}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Bewijsstuk bewerken</h3>
              <div style={{display:'flex', gap:8}}>
                <button className="wm-smallbtn" aria-label="Annuleren" title="Annuleren" onClick={()=>{ if(!isEditDirty() || confirm('Wijzigingen niet opgeslagen. Annuleren?')) setEditArtifactId(null) }}>Annuleren</button>
                <button className="wm-smallbtn wm-primary" aria-label="Opslaan" title="Opslaan (Ctrl+S)" onClick={saveArtifactEdits}>Opslaan</button>
              </div>
            </div>
            <div className="grid" style={{gridTemplateColumns:'1fr 180px'}}>
              <label><span>Naam</span><input value={editArtifactName} onChange={e=>setEditArtifactName(e.target.value)} /></label>
              <label><span>Week</span>
                <select value={editArtifactWeek} onChange={e=>setEditArtifactWeek(Number(e.target.value))}>
                  {yearWeeks.map(w => (<option key={w.week} value={w.week}>{w.code||w.label}</option>))}
                </select>
              </label>
              <label><span>Soort</span>
                <select value={editArtifactKind} onChange={e=>setEditArtifactKind(e.target.value)}>
                  <option value="">—</option>
                  <option value="certificaat">Certificaat</option>
                  <option value="schriftelijk">Schriftelijk product</option>
                  <option value="kennistoets">Kennistoets</option>
                  <option value="vaardigheid">Vaardigheidstest</option>
                  <option value="performance">Performance</option>
                  <option value="gesprek">Gesprek</option>
                  <option value="overig">Overig</option>
                </select>
              </label>
              <label style={{gridColumn:'1 / -1'}}>
                <span>Extra toelichting (optioneel)</span>
                <textarea value={editArtifactNote} onChange={e=> setEditArtifactNote(e.target.value)} placeholder="Context, aanpak, bijzonderheden…" rows={4} />
              </label>
            </div>
            {/* Perspectieven bewerken */}
            <fieldset>
              <legend>Perspectieven</legend>
              <div>
                <label style={{display:'inline-flex',gap:6,marginRight:12}}>
                  <input type="checkbox" checked={(plan.artifacts||[]).find((a:any)=>a.id===editArtifactId)?.perspectives?.length===0 || !(plan.artifacts||[]).find((a:any)=>a.id===editArtifactId)?.perspectives}
                    onChange={()=>{
                      const current = (plan.artifacts||[]).find((a:any)=>a.id===editArtifactId)
                      if(!current) return
                      const next: any[] = []
                      setEditArtifactPersp(next as any)
                      const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
                      const idx = plans.findIndex(pn=>pn.id===plan.id)
                      if(idx>=0){
                        plans[idx] = { ...plans[idx], artifacts: plans[idx].artifacts.map(a=> a.id===editArtifactId ? ({ ...a, perspectives: next }) : a), updatedAt: Date.now() }
                        writeJson(LS_KEYS.plans, plans)
                        const aIdx = (plan.artifacts||[]).findIndex((a:any)=>a.id===editArtifactId)
                        if(aIdx>=0){ (plan.artifacts as any[])[aIdx] = { ...(plan.artifacts as any[])[aIdx], perspectives: next } }
                      }
                    }} /> geen perspectieven
                </label>
                {(['zelfreflectie','peer','ouderejaars','docent','extern'] as const).map(p => (
                  <label key={p} style={{display:'inline-flex',gap:6,marginRight:12}}>
                    <input type="checkbox" checked={(plan.artifacts||[]).find((a:any)=>a.id===editArtifactId)?.perspectives?.includes(p) || false}
                      onChange={()=>{
                        const current = (plan.artifacts||[]).find((a:any)=>a.id===editArtifactId)
                        if(!current) return
                        let next = current.perspectives?.includes(p) ? (current.perspectives||[]).filter((x:any)=>x!==p) : ([...(current.perspectives||[]), p])
                        if(next.length>0){ next = next.filter(Boolean) }
                        setEditArtifactId(editArtifactId) // force rerender
                        setEditArtifactPersp(next as any)
                        const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
                        const idx = plans.findIndex(pn=>pn.id===plan.id)
                        if(idx>=0){
                          plans[idx] = { ...plans[idx], artifacts: plans[idx].artifacts.map(a=> a.id===editArtifactId ? ({ ...a, perspectives: next }) : a), updatedAt: Date.now() }
                          writeJson(LS_KEYS.plans, plans)
                          const aIdx = (plan.artifacts||[]).findIndex((a:any)=>a.id===editArtifactId)
                          if(aIdx>=0){ (plan.artifacts as any[])[aIdx] = { ...(plan.artifacts as any[])[aIdx], perspectives: next } }
                        }
                      }} /> {p}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Leeruitkomsten (EVL)</legend>
              {evlForCourse.map(b=> (
                <div key={b.id} style={{marginBottom:8}}>
                  <div className="muted" style={{fontSize:12}}>{b.id} · {b.name}</div>
                  <div>
                    {b.outcomes.map(o=> (
                      <label key={o.id} title={o.name} style={{display:'inline-flex',gap:6,marginRight:12}}>
                        <input type="checkbox" checked={editArtifactEvl.includes(o.id)} onChange={()=> setEditArtifactEvl(s=> s.includes(o.id) ? s.filter(x=>x!==o.id) : [...s,o.id]) } /> {o.id}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset>
              <legend>Casussen / Thema’s</legend>
              <div>
                {course?.cases.map(c=> (
                  <label key={c.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                    <input type="checkbox" checked={editArtifactCases.includes(c.id)} onChange={()=> setEditArtifactCases(s=> s.includes(c.id) ? s.filter(x=>x!==c.id) : [...s,c.id]) } /> {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Kennisdomeinen</legend>
              <div>
                {course?.knowledgeDomains.map(k=> (
                  <label key={k.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                    <input type="checkbox" checked={editArtifactKnowl.includes(k.id)} onChange={()=> setEditArtifactKnowl(s=> s.includes(k.id) ? s.filter(x=>x!==k.id) : [...s,k.id]) } /> {k.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>VRAAK</legend>
              <div style={{display:'grid', gap:12}}>
                <div>
                  <div style={{fontWeight:600, marginBottom:4}}>Variatie</div>
                  <div className="muted" style={{fontSize:12}}>
                    Variatie beoordeel je over je héle portfolio, niet per individueel datapunt. Kijk in de matrix:
                    <ul style={{margin:'6px 0 0 16px'}}>
                      <li>Per EVL/categorie: spreiding over de tijd.</li>
                      <li>In de VRAAK‑kolom per leeruitkomst/subcategorie: variatie in soorten bewijs en perspectieven.</li>
                    </ul>
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 220px', alignItems:'center', gap:12}}>
                  <div>
                    <div style={{fontWeight:600}}>Relevantie</div>
                    <div className="muted" style={{fontSize:12}}>In hoeverre draagt dit bewijsstuk bij aan de LUK/EVL?</div>
                  </div>
                  <input type="range" min={1} max={5} value={editArtifactVraak.relevantie} onChange={e=> setEditArtifactVraak({ ...editArtifactVraak, relevantie: Number(e.target.value) } as any)} />
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 220px', alignItems:'center', gap:12}}>
                  <div>
                    <div style={{fontWeight:600}}>Authenticiteit</div>
                    <div className="muted" style={{fontSize:12}}>Hoe echt/praktijk‑getrouw is het bewijs en de context?</div>
                  </div>
                  <input type="range" min={1} max={5} value={editArtifactVraak.authenticiteit} onChange={e=> setEditArtifactVraak({ ...editArtifactVraak, authenticiteit: Number(e.target.value) } as any)} />
                </div>
                <div>
                  <div style={{fontWeight:600, marginBottom:4}}>Actualiteit</div>
                  <div className="muted" style={{fontSize:12, marginBottom:6}}>Standaard gaan we uit van de lesweek van dit bewijs. Is de prestatie ouder? Kies hieronder de periode.</div>
                  <label style={{display:'block'}}>
                    <span className="muted" style={{display:'block', fontSize:12, marginBottom:4}}>Periode van prestatie (indien ouder)</span>
                    <select value={editOccurrenceAge} onChange={e=> setEditOccurrenceAge(e.target.value as EvidenceAgeBracket|'' )}>
                      <option value="">Prestatie in geselecteerde lesweek (standaard)</option>
                      <option value="lt6m">Afgelopen half jaar</option>
                      <option value="6to12m">Tussen half jaar en een jaar</option>
                      <option value="1to2y">Tussen 1 en 2 jaar terug</option>
                      <option value="2to3y">Tussen 2 en 3 jaar terug</option>
                      <option value="gt3y">Meer dan 3 jaar terug</option>
                    </select>
                  </label>
                </div>
                <div>
                  <div style={{fontWeight:600, marginBottom:4}}>Kwantiteit</div>
                  <div className="muted" style={{fontSize:12}}>
                    Gaat over verzadiging van bewijs op leeruitkomsten/subcategorieën: is er in totaal voldoende bewijs geleverd om de leeruitkomsten aan te tonen? Dit beoordeel je in de matrix, niet per individueel datapunt.
                  </div>
                </div>
              </div>
            </fieldset>
            {/* footer verwijderd; acties staan in de header */}
          </div>
        </div>
      )}
    </div>
  )
}


