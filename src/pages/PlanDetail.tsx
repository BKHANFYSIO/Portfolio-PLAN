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
  const [editArtifactPersp, setEditArtifactPersp] = useState<PerspectiveKey[]>([])
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
  }

  function saveArtifactEdits(){
    if(!editArtifactId) return
    const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
    const idx = plans.findIndex(p=>p.id===plan.id)
    if(idx>=0){
      plans[idx] = { ...plans[idx], artifacts: plans[idx].artifacts.map((a:any)=> a.id===editArtifactId ? ({ ...a, name: editArtifactName.trim()||a.name, week: Number(editArtifactWeek), kind: editArtifactKind||undefined, perspectives: editArtifactPersp, evlOutcomeIds: editArtifactEvl, caseIds: editArtifactCases, knowledgeIds: editArtifactKnowl, vraak: editArtifactVraak, updatedAt: Date.now() }) : a), updatedAt: Date.now() }
      writeJson(LS_KEYS.plans, plans)
      // update lokaal object zodat lijst ververst
      const aIdx = (plan.artifacts||[]).findIndex((a:any)=>a.id===editArtifactId)
      if(aIdx>=0){ (plan.artifacts as any[])[aIdx] = { ...(plan.artifacts as any[])[aIdx], name: editArtifactName.trim()||editArtifactName, week: Number(editArtifactWeek), kind: editArtifactKind||undefined, perspectives: editArtifactPersp } }
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
    // Zorg dat alles uitgeklapt is vóór export
    window.dispatchEvent(new Event('wm-export-expand-all'))
    // Zet years tijdelijk op window, zodat PDF‑template bij detailpagina’s weekcode/datum kan tonen
    ;(window as any).__pfYears = getYears()
    await new Promise(r=> setTimeout(r, 100))
    const wrap = container.querySelector('.wm-wrap') as HTMLElement | null
    // Forceer export-modus: sticky off, alles zichtbaar
    wrap?.classList.add('wm-export')
    // Bewaar en reset scrollposities zodat alles in beeld is
    const prevScrollLeft = wrap?.scrollLeft || 0
    const prevScrollTop = wrap?.scrollTop || 0
    if(wrap){ wrap.scrollLeft = 0; wrap.scrollTop = 0 }
    const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' })
    const canvas = await html2canvas(container, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2, windowWidth: container.scrollWidth, windowHeight: container.scrollHeight })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const scale = canvas.width / container.scrollWidth
    // Maximale canvas-hoogte die op één A4 past bij breedte=pageW
    const maxSliceCanvasH = Math.floor(canvas.width * (pageH / pageW))

    // Bepaal blokken (EVL/categorieën) uit de wm-body, zodat we nooit binnen een blok breken
    const body = container.querySelector('.wm-body') as HTMLElement | null
    const header = container.querySelector('.wm-header') as HTMLElement | null
    const headerCanvasH = Math.floor((header?.offsetHeight || 0) * scale)
    const blocksAll = Array.from((body?.children || []) as any as HTMLElement[])
    // Filter alleen EVL-groepen en secties (kop + rijen) als blokken
    const blocks = blocksAll.filter(el => el.querySelector('.wm-evlhead') || el.classList.contains('wm-row'))

    // Helper: hoogte in canvas-px van een element
    const toC = (px:number)=> Math.floor(px * scale)

    // Stel pagina-slices samen op canvas-coördinaten (startY, height)
    type Slice = { start: number; height: number }
    const slices: Slice[] = []
    let curStart = 0
    let curH = 0

    // Neem header mee op de eerste pagina
    if(headerCanvasH>0){ curH += headerCanvasH }

    for(const block of blocks){
      const blockH = toC(block.offsetHeight)
      const fitsInEmpty = blockH <= maxSliceCanvasH
      const hasSpace = (curH + blockH) <= maxSliceCanvasH
      if(hasSpace){
        curH += blockH
        continue
      }
      // Als huidige pagina iets bevat → finalizeer en start nieuwe
      if(curH>0){ slices.push({ start: curStart, height: curH }); curStart += curH; curH = 0 }
      // Past het blok op een lege pagina? Dan plaats het in één keer, anders splits op rijen
      if(fitsInEmpty){
        curH = blockH
      }else{
        // Splits op subrijen binnen dit blok (evlhead + .wm-row)
        const head = block.querySelector('.wm-evlhead') as HTMLElement | null
        const headH = toC(head?.offsetHeight || 0)
        const rows = Array.from(block.querySelectorAll('.wm-row')) as HTMLElement[]
        const rowHs = rows.map(r => toC(r.offsetHeight))
        let idx = 0
        while(idx < rowHs.length){
          // Start met (optionele) evlhead op elke vervolgpagina van dit blok
          let part = 0
          if(headH>0){ part += headH }
          while(idx < rowHs.length && (part + rowHs[idx]) <= maxSliceCanvasH){
            part += rowHs[idx]; idx++
          }
          // Als huidige pagina nog leeg is, neem dit deel; anders sluit vorige pagina af
          if(curH>0){ slices.push({ start: curStart, height: curH }); curStart += curH; curH = 0 }
          curH = part
          // Als er nog rijen overblijven na vullen, sluit direct af en ga door
          if(idx < rowHs.length){ slices.push({ start: curStart, height: curH }); curStart += curH; curH = 0 }
        }
      }
    }
    if(curH>0){ slices.push({ start: curStart, height: curH }) }

    // Render elke slice als aparte pagina
    for(let i=0;i<slices.length;i++){
      const { start, height } = slices[i]
      const partCanvas = document.createElement('canvas')
      partCanvas.width = canvas.width
      partCanvas.height = height
      const ctx = partCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, start, canvas.width, height, 0, 0, canvas.width, height)
      const img = partCanvas.toDataURL('image/png')
      const drawH = height * (pageW / canvas.width)
      if(i===0){
        doc.addImage(img, 'PNG', 0, 0, pageW, drawH)
      }else{
        doc.addPage('a4','landscape')
        doc.addImage(img, 'PNG', 0, 0, pageW, drawH)
      }
    }
    // Detailpagina's na de matrix
    const yearsLocal = getYears()
    for(const a of (plan.artifacts||[])){
      const info = yearsLocal.find(y=>y.year===plan.year)?.weeks.find(ww=> ww.week===a.week)
      const code = info?.code || info?.label || `Week ${a.week}`
      const weekText = info?.startISO ? `${code} · ${info.startISO}` : code
      doc.addPage('a4','landscape')
      const wrap = document.createElement('div')
      wrap.style.width = '1000px'
      wrap.style.padding = '16px'
      wrap.style.background = getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff'
      wrap.innerHTML = `
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">${a.name}</div>
        <div style="display:flex;gap:12px;margin-bottom:8px;color:#9aa6c6">${weekText} · Soort: ${a.kind||'—'}</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:8px;margin-bottom:10px">
          <div>EVL</div><div>${(a.evlOutcomeIds||[]).join(', ')||'—'}</div>
          <div>Casus / Thema</div><div>${(a.caseIds||[]).join(', ')||'—'}</div>
          <div>Kennis</div><div>${(a.knowledgeIds||[]).join(', ')||'—'}</div>
        </div>
        <div style="display:grid;grid-template-columns:120px 1fr;gap:6px">
          <div>Variatie</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.variatie||0)/5*100}%"></div></div></div>
          <div>Relevantie</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.relevantie||0)/5*100}%"></div></div></div>
          <div>Authenticiteit</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.authenticiteit||0)/5*100}%"></div></div></div>
          <div>Actualiteit</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.actualiteit||0)/5*100}%"></div></div></div>
          <div>Kwantiteit</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.kwantiteit||0)/5*100}%"></div></div></div>
        </div>`
      document.body.appendChild(wrap)
      const c2 = await html2canvas(wrap, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2 })
      const img2 = c2.toDataURL('image/png')
      const r2 = Math.min(pageW / c2.width, pageH / c2.height)
      const w2 = c2.width * r2, h2 = c2.height * r2
      const x2 = (pageW - w2)/2, y2 = (pageH - h2)/2
      doc.addImage(img2, 'PNG', x2, y2, w2, h2)
      document.body.removeChild(wrap)
    }
    doc.save(`${localName.replace(/\s+/g,'_')}_portfolio.pdf`)
    // Herstel state
    if(wrap){ wrap.classList.remove('wm-export'); wrap.scrollLeft = prevScrollLeft; wrap.scrollTop = prevScrollTop }
  }

  // Verwijderd auto-open via query; popup verschijnt alleen via knop

  // Instructies en varianten voor PDF-export
  const [showPdfGuide, setShowPdfGuide] = useState(false)
  async function exportPdfCurrentView(){
    setShowPdfGuide(false)
    await exportPdf()
  }
  async function exportPdfHalves(){
    setShowPdfGuide(false)
    const container = document.querySelector('.center') as HTMLElement | null
    const wrap = document.querySelector('.wm-wrap') as HTMLElement | null
    if(!container || !wrap){ await exportPdf(); return }
    const prev = wrap.scrollLeft
    const max = Math.max(0, (wrap.scrollWidth - wrap.clientWidth))
    const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const capture = async ()=>{
      const canvas = await html2canvas(container, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2 })
      const img = canvas.toDataURL('image/png')
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
      const w = canvas.width * ratio; const h = canvas.height * ratio
      const x = (pageW - w)/2, y = (pageH - h)/2
      doc.addImage(img, 'PNG', x, y, w, h)
    }
    // Eerste helft (links)
    wrap.scrollLeft = 0; await new Promise(r=> setTimeout(r, 200)); await capture()
    // Tweede helft (rechts), alleen als er iets te scrollen is
    if(max > 0){ doc.addPage('a4','landscape'); wrap.scrollLeft = max; await new Promise(r=> setTimeout(r, 200)); await capture() }
    // Detailpagina's daarna
    for(const a of (plan.artifacts||[])){
      doc.addPage('a4','landscape')
      const wrapEl = document.createElement('div')
      wrapEl.style.width = '1000px'
      wrapEl.style.padding = '16px'
      wrapEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff'
      wrapEl.innerHTML = `
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">${a.name}</div>
        <div style="display:flex;gap:12px;margin-bottom:8px;color:#9aa6c6">Week ${a.week} · Soort: ${a.kind||'—'}</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:8px;margin-bottom:10px">
          <div>EVL</div><div>${(a.evlOutcomeIds||[]).join(', ')||'—'}</div>
          <div>Casus</div><div>${(a.caseIds||[]).join(', ')||'—'}</div>
          <div>Kennis</div><div>${(a.knowledgeIds||[]).join(', ')||'—'}</div>
        </div>
        <div style="display:grid;grid-template-columns:120px 1fr;gap:6px">
          <div>Variatie</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.variatie||0)/5*100}%"></div></div></div>
          <div>Relevantie</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.relevantie||0)/5*100}%"></div></div></div>
          <div>Authenticiteit</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.authenticiteit||0)/5*100}%"></div></div></div>
          <div>Actualiteit</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.actualiteit||0)/5*100}%"></div></div></div>
          <div>Kwantiteit</div><div><div style="height:8px;background:rgba(255,255,255,.08)"><div style="height:8px;background:#4f7cff;width:${(a.vraak?.kwantiteit||0)/5*100}%"></div></div></div>
        </div>`
      document.body.appendChild(wrapEl)
      const c2 = await html2canvas(wrapEl, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') || '#ffffff', scale:2 })
      const img2 = c2.toDataURL('image/png')
      const r2 = Math.min(pageW / c2.width, pageH / c2.height)
      const w2 = c2.width * r2, h2 = c2.height * r2
      const x2 = (pageW - w2)/2, y2 = (pageH - h2)/2
      doc.addImage(img2, 'PNG', x2, y2, w2, h2)
      document.body.removeChild(wrapEl)
    }
    wrap.scrollLeft = prev
    doc.save(`${localName.replace(/\s+/g,'_')}_portfolio_halves.pdf`)
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

      {showAdd && <AddArtifactDialog plan={{...plan, name: localName}} onClose={()=>setShowAdd(false)} onSaved={()=>{}} />}

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
            <h3>PDF export</h3>
            <ul>
              <li>De volledige matrix wordt automatisch over meerdere A4’s verdeeld.</li>
              <li>Kolomkoppen (weken) worden per pagina herhaald voor leesbaarheid.</li>
            </ul>
            <div className="dialog-actions">
              <button className="file-label" onClick={()=>setShowPdfGuide(false)}>Sluiten</button>
              <button className="btn" onClick={exportPdfCurrentView}>Exporteer naar PDF</button>
            </div>
          </div>
        </div>
      )}
      {showEdit && (
        <div className="modal-backdrop" onClick={()=>setShowEdit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Plan bewerken</h3>
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
            <div className="modal-header"><h3 style={{margin:0}}>Alle bewijsstukken</h3></div>
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
                            <span>
                              <button className="file-label" onClick={()=>startEditArtifact(a)}>Bewerken</button>
                              <button className="danger" style={{marginLeft:6}} onClick={()=>deleteArtifact(a.id)}>Verwijderen</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              <div style={{fontWeight:600, marginTop:4}}>Binnen geselecteerde weken</div>
                  <ul>
                    {yearWeeks.filter(w=> visibleSet.has(w.week)).map(w => (
                      <li key={w.week} style={{padding:'6px 0'}}>
                        <div className="muted" style={{fontSize:12}}>{w.code||w.label}</div>
                        <ul>
                      {(weeksMap.get(w.week)||[]).length>0 ? (weeksMap.get(w.week)||[]).map((a:any) => (
                        <li key={a.id} style={{display:'flex', justifyContent:'space-between', gap:8}}>
                          <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                              <KindIcon kind={a.kind} />
                              {Array.isArray(a.perspectives) && a.perspectives.slice(0,3).map((p:string)=> (<PerspectiveIcon key={p} p={p as any} />))}
                              {Array.isArray(a.perspectives) && a.perspectives.length>3 && (
                                <span className="muted" style={{fontSize:10}}>+{a.perspectives.length-3}</span>
                              )}
                            </span>
                            {a.name}
                          </span>
                              <span>
                                <button className="file-label" onClick={()=>startEditArtifact(a)}>Bewerken</button>
                                <button className="danger" style={{marginLeft:6}} onClick={()=>deleteArtifact(a.id)}>Verwijderen</button>
                              </span>
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
            <div className="modal-footer">
              <button className="btn" onClick={()=>setShowList(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {showPdfGuide && (
        <div className="dialog-backdrop" onClick={()=>setShowPdfGuide(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <h3>PDF export – beste resultaat</h3>
            <ul>
              <li>Zoom eerst zó in dat alle lesweken zichtbaar zijn in de matrix.</li>
              <li>Sluit deze pop‑up en controleer of je echt alle kolommen ziet.</li>
              <li>Is de tekst te klein? Kies “Exporteer in twee helften”.</li>
            </ul>
            <div className="dialog-actions">
              <button className="file-label" onClick={()=>setShowPdfGuide(false)}>Sluiten</button>
              <button className="file-label" onClick={exportPdfCurrentView}>PDF van huidige weergave</button>
              <button className="btn" onClick={exportPdfHalves}>Exporteer in twee helften</button>
            </div>
          </div>
        </div>
      )}

      {editArtifactId && (
        <div className="modal-backdrop" onClick={()=>setEditArtifactId(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Bewijsstuk bewerken</h3>
              <button className="wm-smallbtn" aria-label="Sluiten" onClick={()=>setEditArtifactId(null)}>Sluiten</button>
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
              <div className="grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
                {(['variatie','relevantie','authenticiteit','actualiteit','kwantiteit'] as const).map(k => (
                  <label key={k}><span style={{textTransform:'capitalize'}}>{k}</span>
                    <input type="range" min={1} max={5} value={(editArtifactVraak as any)[k]} onChange={e=> setEditArtifactVraak({ ...editArtifactVraak, [k]: Number(e.target.value) } as any)} />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="dialog-actions">
              <button className="file-label" onClick={()=>setEditArtifactId(null)}>Annuleren</button>
              <button className="btn" onClick={saveArtifactEdits}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


