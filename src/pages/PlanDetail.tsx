import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { PortfolioPlan } from '../lib/storage'
import './planDetail.css'
import AddArtifactDialog from '../components/AddArtifactDialog'
import WeekMatrix from '../components/WeekMatrix'
import { getYears } from '../lib/curriculum'
import { KindIcon, PerspectiveIcon } from '../components/icons'
import type { PerspectiveKey } from '../lib/storage'
import { getCurriculum } from '../lib/curriculum'

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
  const { evl, courses } = getCurriculum()
  const course = useMemo(()=> courses.find(c=>c.id===plan.courseId), [courses, plan.courseId])
  const evlExcluded = course?.evlOverrides?.EVL1 || []
  const evlForCourse = useMemo(()=> evl.map(b => b.id==='EVL1' ? ({...b, outcomes: b.outcomes.filter(o=>!evlExcluded.includes(o.id))}) : b), [evl])
  const [editArtifactEvl, setEditArtifactEvl] = useState<string[]>([])
  const [editArtifactCases, setEditArtifactCases] = useState<string[]>([])
  const [editArtifactKnowl, setEditArtifactKnowl] = useState<string[]>([])
  const [editArtifactVraak, setEditArtifactVraak] = useState({ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 })
  const [editArtifactPersp, setEditArtifactPersp] = useState<PerspectiveKey[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: plan?.name || '',
    periodType: (plan?.period?.type as 'periode'|'semester'|'maatwerk') || 'periode',
    periodPeriode: String(plan?.period?.type==='periode' ? plan?.period?.value : 1),
    periodSemester: String(plan?.period?.type==='semester' ? plan?.period?.value : 1),
    periodStartWeek: String(plan?.period?.type==='maatwerk' ? (plan?.period?.value as number[])[0] : ''),
    periodEndWeek: String(plan?.period?.type==='maatwerk' ? (plan?.period?.value as number[])[1] : ''),
  })
  const yearWeeks = getYears().find(y=>y.year===plan.year)?.weeks || []

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

  return (
    <div className="detail">
      <header className="detail-header">
        <div>
          <h1>{localName}</h1>
          <div className="muted">{plan.year} · {plan.courseName} · {localPeriod?.label}</div>
        </div>
        <div className="actions">
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
          <button className="btn" onClick={openEdit}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
            Bewerken
          </button>
        </div>
      </header>

      <section className="layout">
        <main className="center">
          
          <h3 style={{marginTop:16}}>Matrix (LUK x weken)</h3>
          <WeekMatrix
            plan={{...plan, name: localName, period: localPeriod}}
            onEdit={(a)=>{ startEditArtifact(a as any); }}
          />
        </main>
      </section>

      {showAdd && <AddArtifactDialog plan={{...plan, name: localName}} onClose={()=>setShowAdd(false)} onSaved={()=>{}} />}
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
            <h3>Alle bewijsstukken</h3>
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
            <div style={{marginTop:12, textAlign:'right'}}>
              <button className="btn" onClick={()=>setShowList(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {editArtifactId && (
        <div className="modal-backdrop" onClick={()=>setEditArtifactId(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Bewijsstuk bewerken</h3>
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
              <legend>Casussen</legend>
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


