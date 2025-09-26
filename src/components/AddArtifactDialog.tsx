import { useEffect, useMemo, useState } from 'react'
import { generateId, LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { Artifact, PortfolioPlan } from '../lib/storage'
import type { PerspectiveKey } from '../lib/storage'
import { getCurriculumForYear, getYears } from '../lib/curriculum'

type Props = { plan: PortfolioPlan; onClose: ()=>void; onSaved: (a:Artifact)=>void }

export default function AddArtifactDialog({ plan, onClose, onSaved }: Props){
  const { evl, courses } = getCurriculumForYear(plan.year)
  const course = courses.find(c=>c.id===plan.courseId)
  const yearWeeks = getYears().find(y=>y.year===plan.year)?.weeks || []
  const templates = readJson<any[]>('pf-templates', [])

  const initialMode = (localStorage.getItem('pf-add-mode') as 'wizard'|'full') || 'wizard'
  const [mode, setMode] = useState<'wizard'|'full'>(initialMode)
  const [step, setStep] = useState(0) // stap 0 = keuze sjabloon of vrije invoer
  const TOTAL_STEPS = 6
  const [startChoice, setStartChoice] = useState<'template'|'free'|''>('')
  const [chosenTemplate, setChosenTemplate] = useState<string>('')
  const [name, setName] = useState('')
  const [week, setWeek] = useState<number|''>('')
  const [evlOutcomeIds, setEvlOutcomeIds] = useState<string[]>([])
  const [caseIds, setCaseIds] = useState<string[]>([])
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>([])
  const [vraak, setVraak] = useState({ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 })
  const [kind, setKind] = useState<string>('')
  const [persp, setPersp] = useState<PerspectiveKey[]>([])
  function applyTemplateByName(name: string){
    const t = templates.find(x=> x.name===name)
    if(!t) return
    setName(t.name)
    setEvlOutcomeIds([...(t.evl||[])])
    setCaseIds([...(t.cases||[])])
    setKnowledgeIds([...(t.knowledge||[])])
    setVraak({ ...(t.vraak||{ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 }) })
    if(t.kind){ setKind(t.kind) }
  }


  const evlForCourse = useMemo(()=> {
    const overrides = (course?.evlOverrides)||{}
    return evl.map(b => {
      const excluded = (overrides as any)[b.id] || []
      return ({ ...b, outcomes: b.outcomes.filter(o=> !excluded.includes(o.id)) })
    })
  }, [evl, course])

  function visibleWeekNumbers(){
    const all = yearWeeks
    if(plan.period?.type==='periode'){
      const p = Number(plan.period.value)
      const filtered = all.filter(w=> w.kind!=='zero')
      const startIdx = filtered.findIndex(w=> String(w.code||'')===`${p}.1`)
      if(startIdx===-1) return filtered.map(w=>w.week)
      const nextIdx = filtered.findIndex(w=> String(w.code||'')===`${p+1}.1`)
      const endIdx = nextIdx===-1 ? filtered.length : nextIdx
      return filtered.slice(startIdx, endIdx).map(w=>w.week)
    }
    if(plan.period?.type==='semester'){
      const s = Number(plan.period.value)
      const filtered = all.filter(w=> w.kind!=='zero')
      const idx = (label:string)=> filtered.findIndex(w=> String(w.code||'')===label)
      const p1 = idx('1.1'); const p3 = idx('3.1')
      if(p1>=0 && p3>p1){
        if(s===1) return filtered.slice(p1, p3).map(w=>w.week)
        return filtered.slice(p3).map(w=>w.week)
      }
      const half = Math.ceil(filtered.length/2)
      if(s===1) return filtered.slice(0,half).map(w=>w.week)
      return filtered.slice(half).map(w=>w.week)
    }
    if(plan.period?.type==='maatwerk' && Array.isArray(plan.period.value)){
      const [start,end] = plan.period.value
      return all.filter(w=> w.week>=start && w.week<=end).map(w=>w.week)
    }
    return all.map(w=>w.week)
  }

  const visibleWeeks = useMemo(()=> visibleWeekNumbers(), [plan.period, yearWeeks])

  useEffect(()=>{
    if(visibleWeeks.length && week==='') setWeek(visibleWeeks[0])
  }, [visibleWeeks])

  function toggle<T extends string>(arr: T[], v: T, set:(x:T[])=>void){
    set(arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v])
  }

  function save(){
    if(!name.trim()) return alert('Naam is verplicht')
    if(!week || Number(week) <= 0) return alert('Week is verplicht')
    if(!kind) return alert('Kies het soort bewijs (verplicht)')
    const artifact: Artifact = {
      id: generateId('art'), name: name.trim(), week: Number(week), evlOutcomeIds, caseIds, knowledgeIds, vraak,
      kind: kind as any,
      perspectives: persp,
      createdAt: Date.now(), updatedAt: Date.now()
    }
    const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
    const idx = plans.findIndex(p=>p.id===plan.id)
    if(idx>=0){
      plans[idx] = { ...plans[idx], artifacts: [artifact, ...plans[idx].artifacts], updatedAt: Date.now() }
      writeJson(LS_KEYS.plans, plans)
      onSaved(artifact)
      onClose()
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={e=>e.stopPropagation()}>
        <h3>Bewijsstuk toevoegen</h3>
        <div style={{display:'flex', gap:8, marginBottom:8}}>
          <button className="file-label" onClick={()=>{ setMode('wizard'); setStep(0); setStartChoice(''); setChosenTemplate(''); localStorage.setItem('pf-add-mode','wizard') }} disabled={mode==='wizard'}>Stappen</button>
          <button className="file-label" onClick={()=>{ setMode('full'); setStep(0); setStartChoice(''); setChosenTemplate(''); localStorage.setItem('pf-add-mode','full') }} disabled={mode==='full'}>Formulier</button>
        </div>
        {mode==='wizard' && <div className="muted" style={{marginBottom:8}}>Stap {step+1} van {TOTAL_STEPS}</div>}

        {step===0 && (
          <div>
            <h4>Startoptie</h4>
            <div style={{display:'grid', gap:8}}>
              <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                <input type="radio" checked={startChoice==='template'} onChange={()=>{ setStartChoice('template') }} /> Sjabloon gebruiken
              </label>
              {startChoice==='template' && (
                <div style={{paddingLeft:22}}>
                  <label style={{display:'block'}}>
                    <span className="muted" style={{display:'block',fontSize:12,marginBottom:4}}>Kies sjabloon</span>
                    <select value={chosenTemplate} onChange={e=> setChosenTemplate(e.target.value)}>
                      <option value="">Kies sjabloon…</option>
                      {(() => {
                        const normalize = (s:string)=> String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'')
                        const cn = normalize(course?.name||'')
                        const templs = templates.filter(t => {
                          const list = (t as any).courses as string[] | undefined
                          if(Array.isArray(list) && list.length>0){
                            const ok = list.some(x => normalize(x)===cn)
                            return ok
                          }
                          return true
                        })
                        const final = templs.length>0 ? templs : templates
                        return final.map(t=> <option key={t.name} value={t.name}>{t.name}</option>)
                      })()}
                    </select>
                  </label>
                  <div className="muted" style={{fontSize:12, marginTop:6}}>
                    {(templates.find(x=>x.name===chosenTemplate)?.note) || 'Het sjabloon vult velden alvast voor je in. Alles is later nog aan te passen.'}
                  </div>
                </div>
              )}
              <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                <input type="radio" checked={startChoice==='free'} onChange={()=>{ setStartChoice('free') }} /> Vrije invoer
              </label>
              {startChoice==='free' && (
                <div className="muted" style={{fontSize:12, paddingLeft:22}}>
                  Je hebt gekozen voor volledige vrijheid. Je bepaalt zelf de naam, het type bewijs, de leeruitkomsten en de VRAAK-criteria. Gebruik deze optie als je een uniek datapunt wilt toevoegen dat niet in een sjabloon past.
                </div>
              )}
            </div>
          </div>
        )}

        {mode==='wizard' && step===1 && (
          <div className="grid" style={{gridTemplateColumns:'1fr 180px'}}>
            <label><span>Naam</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="bijv. e-learning certificaat"/></label>
            <label><span>Week</span>
              <select value={week} onChange={e=>setWeek(Number(e.target.value) as any)}>
                {yearWeeks.filter(w=> visibleWeeks.includes(w.week)).map(w => {
                  const label = `${w.code||w.label}${w.startISO ? ' — '+w.startISO : ''}`
                  return <option key={w.week} value={w.week}>{label}</option>
                })}
              </select>
            </label>
            <label><span>Soort (verplicht)</span>
              <select value={kind} onChange={e=>setKind(e.target.value)}>
                <option value="">Kies soort…</option>
                <option value="certificaat">Certificaat</option>
                <option value="schriftelijk">Schriftelijk product</option>
                <option value="kennistoets">Kennistoets</option>
                <option value="vaardigheid">Vaardigheidstest</option>
                <option value="performance">Performance</option>
                <option value="gesprek">Gesprek</option>
                <option value="overig">Overig</option>
              </select>
            </label>
            {/* sjabloonselect is verplaatst naar stap 0; in full-mode blijft hij beschikbaar */}
            <label style={{gridColumn:'1 / -1'}}>
              <span>Perspectieven (meerdere mogelijk)</span>
              <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                <label style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                  <input type="checkbox" checked={persp.length===0} onChange={()=> setPersp([])} /> geen perspectieven
                </label>
                {(['zelfreflectie','docent','student-p','student-hf1','student-hf2-3','stagebegeleider','patient','overig'] as PerspectiveKey[]).map(p => (
                  <label key={p} style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                    <input type="checkbox" checked={persp.includes(p)} onChange={()=> setPersp(s=> s.includes(p) ? s.filter(x=>x!==p) : [...s,p]) } /> {p}
                  </label>
                ))}
              </div>
            </label>
          </div>
        )}

        {mode==='wizard' && step===2 && (
          <div>
            <h4>EVL leeruitkomsten</h4>
            {evlForCourse.map(b=> (
              <div key={b.id} style={{marginTop:8}}>
                <div className="evl-title">{b.id} · {b.name}</div>
                <div className="luk">
                  {b.outcomes.map(o=> (
                    <label key={o.id} title={o.name} style={{display:'inline-flex',gap:6,marginRight:12}}>
                      <input type="checkbox" checked={evlOutcomeIds.includes(o.id)} onChange={()=>toggle(evlOutcomeIds,o.id,setEvlOutcomeIds)} /> {o.id}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {mode==='wizard' && step===3 && (
          <div>
            <h4>Casussen / Thema’s</h4>
            <div className="luk">
              {(course?.cases||[]).map(c=> (
                <label key={c.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                  <input type="checkbox" checked={caseIds.includes(c.id)} onChange={()=>toggle(caseIds,c.id,setCaseIds)} /> {c.name}
                </label>
              ))}
            </div>
            <h4>Kennisdomeinen</h4>
            <div className="luk">
              {(course?.knowledgeDomains||[]).map(k=> (
                <label key={k.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                  <input type="checkbox" checked={knowledgeIds.includes(k.id)} onChange={()=>toggle(knowledgeIds,k.id,setKnowledgeIds)} /> {k.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {mode==='wizard' && step===4 && (
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))'}}>
            {(['variatie','relevantie','authenticiteit','actualiteit','kwantiteit'] as const).map(k => (
              <label key={k}><span>{k}</span>
                <input type="range" min={1} max={5} value={vraak[k]} onChange={e=>setVraak({ ...vraak, [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
        )}

        {mode==='wizard' && step===5 && (
          <div>
            <h4>Controle</h4>
            <div className="muted">Naam: {name || '—'} · Week: {week || '—'}</div>
            <div className="muted">LUK: {evlOutcomeIds.join(', ') || '—'}</div>
            <div className="muted">Casus: {caseIds.length||'—'} · Kennis: {knowledgeIds.length||'—'}</div>
          </div>
        )}

        {mode==='wizard' ? (
          <div className="dialog-actions">
            {step>0 ? <button onClick={()=>setStep(step-1)}>Terug</button> : <button onClick={onClose}>Annuleren</button>}
            {step<(TOTAL_STEPS-1) ? (
              <button
                onClick={()=>{ if(step===0 && startChoice==='template' && chosenTemplate){ applyTemplateByName(chosenTemplate) } setStep(step+1) }}
                disabled={step===0 && (startChoice==='' || (startChoice==='template' && !chosenTemplate))}
              >Volgende</button>
            ) : (
              <button onClick={save}>Opslaan</button>
            )}
          </div>
        ) : (
          <>
            {step===0 ? (
              <>
                <div>
                  <h4>Startoptie</h4>
                  <div style={{display:'grid', gap:8}}>
                    <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                      <input type="radio" checked={startChoice==='template'} onChange={()=>{ setStartChoice('template') }} /> Sjabloon gebruiken
                    </label>
                    {startChoice==='template' && (
                      <div style={{paddingLeft:22}}>
                        <label style={{display:'block'}}>
                          <span className="muted" style={{display:'block',fontSize:12,marginBottom:4}}>Kies sjabloon</span>
                          <select value={chosenTemplate} onChange={e=> setChosenTemplate(e.target.value)}>
                            <option value="">Kies sjabloon…</option>
                            {(() => {
                              const normalize = (s:string)=> String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'')
                              const cn = normalize(course?.name||'')
                              const templs = templates.filter(t => {
                                const list = (t as any).courses as string[] | undefined
                                if(Array.isArray(list) && list.length>0){
                                  const ok = list.some(x => normalize(x)===cn)
                                  return ok
                                }
                                return true
                              })
                              const final = templs.length>0 ? templs : templates
                              return final.map(t=> <option key={t.name} value={t.name}>{t.name}</option>)
                            })()}
                          </select>
                        </label>
                        <div className="muted" style={{fontSize:12, marginTop:6}}>
                          {(templates.find(x=>x.name===chosenTemplate)?.note) || 'Het sjabloon vult velden alvast voor je in. Alles is later nog aan te passen.'}
                        </div>
                      </div>
                    )}
                    <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                      <input type="radio" checked={startChoice==='free'} onChange={()=>{ setStartChoice('free') }} /> Vrije invoer
                    </label>
                    {startChoice==='free' && (
                      <div className="muted" style={{fontSize:12, paddingLeft:22}}>
                        Je hebt gekozen voor volledige vrijheid. Je bepaalt zelf de naam, het type bewijs, de leeruitkomsten en de VRAAK-criteria. Gebruik deze optie als je een uniek datapunt wilt toevoegen dat niet in een sjabloon past.
                      </div>
                    )}
                  </div>
                </div>
                <div className="dialog-actions">
                  <button className="file-label" onClick={onClose}>Annuleren</button>
                  <button className="btn" onClick={()=>{ if(startChoice==='template' && chosenTemplate){ applyTemplateByName(chosenTemplate) } setStep(1) }} disabled={startChoice==='' || (startChoice==='template' && !chosenTemplate)}>Volgende</button>
                </div>
              </>
            ) : (
            <>
            <div className="grid" style={{gridTemplateColumns:'1fr 180px'}}>
              <label><span>Naam</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="bijv. e-learning certificaat"/></label>
              <label><span>Week</span>
                <select value={week} onChange={e=>setWeek(Number(e.target.value) as any)}>
                  {yearWeeks.filter(w=> visibleWeeks.includes(w.week)).map(w => {
                    const label = `${w.code||w.label}${w.startISO ? ' — '+w.startISO : ''}`
                    return <option key={w.week} value={w.week}>{label}</option>
                  })}
                </select>
              </label>
              <label><span>Soort (verplicht)</span>
                <select value={kind} onChange={e=>setKind(e.target.value)}>
                  <option value="">Kies soort…</option>
                  <option value="certificaat">Certificaat</option>
                  <option value="schriftelijk">Schriftelijk product</option>
                  <option value="kennistoets">Kennistoets</option>
                  <option value="vaardigheid">Vaardigheidstest</option>
                  <option value="performance">Performance</option>
                  <option value="gesprek">Gesprek</option>
                  <option value="overig">Overig</option>
                </select>
              </label>
              {templates.length>0 && (
                <label><span>Sjabloon</span>
                  <select onChange={e=>{
                    const t = templates.find(x=> x.name===e.target.value)
                    if(!t) return
                    setName(t.name)
                    setEvlOutcomeIds([...(t.evl||[])])
                    setCaseIds([...(t.cases||[])])
                    setKnowledgeIds([...(t.knowledge||[])])
                    setVraak({ ...(t.vraak||{ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 }) })
                    if(t.kind){ setKind(t.kind) }
                  }}>
                    <option value="">Kies sjabloon…</option>
                    {templates.map(t=> <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </label>
              )}
              <label style={{gridColumn:'1 / -1'}}>
                <span>Perspectieven (meerdere mogelijk)</span>
                <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                  <label style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                    <input type="checkbox" checked={persp.length===0} onChange={()=> setPersp([])} /> geen perspectieven
                  </label>
                  {(['zelfreflectie','peer','ouderejaars','docent','extern'] as PerspectiveKey[]).map(p => (
                    <label key={p} style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                      <input type="checkbox" checked={persp.includes(p)} onChange={()=> setPersp(s=> s.includes(p) ? s.filter(x=>x!==p) : [...s,p]) } /> {p}
                    </label>
                  ))}
                </div>
              </label>
            </div>
            <fieldset>
              <legend>EVL leeruitkomsten</legend>
              {evlForCourse.map(b=> (
                <div key={b.id} style={{marginBottom:8}}>
                  <div className="muted" style={{fontSize:12}}>{b.id} · {b.name}</div>
                  <div>
                    {b.outcomes.map(o=> (
                      <label key={o.id} title={o.name} style={{display:'inline-flex',gap:6,marginRight:12}}>
                        <input type="checkbox" checked={evlOutcomeIds.includes(o.id)} onChange={()=>toggle(evlOutcomeIds,o.id,setEvlOutcomeIds)} /> {o.id}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset>
              <legend>Casussen / Thema’s</legend>
              <div>
                {(course?.cases||[]).map(c=> (
                  <label key={c.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                    <input type="checkbox" checked={caseIds.includes(c.id)} onChange={()=>toggle(caseIds,c.id,setCaseIds)} /> {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Kennisdomeinen</legend>
              <div>
                {(course?.knowledgeDomains||[]).map(k=> (
                  <label key={k.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                    <input type="checkbox" checked={knowledgeIds.includes(k.id)} onChange={()=>toggle(knowledgeIds,k.id,setKnowledgeIds)} /> {k.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>VRAAK</legend>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))'}}>
                {(['variatie','relevantie','authenticiteit','actualiteit','kwantiteit'] as const).map(k => (
                  <label key={k}><span>{k}</span>
                    <input type="range" min={1} max={5} value={vraak[k]} onChange={e=>setVraak({ ...vraak, [k]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="dialog-actions">
              <button className="file-label" onClick={onClose}>Annuleren</button>
              <button className="btn" onClick={save}>Opslaan</button>
            </div>
            </>
            )}
          </>
        )}
      </div>
    </div>
  )
}


