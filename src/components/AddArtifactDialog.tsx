import { useMemo, useState } from 'react'
import { generateId, LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { Artifact, PortfolioPlan } from '../lib/storage'
import { getCurriculum } from '../lib/curriculum'

type Props = { plan: PortfolioPlan; onClose: ()=>void; onSaved: (a:Artifact)=>void }

export default function AddArtifactDialog({ plan, onClose, onSaved }: Props){
  const { evl, courses } = getCurriculum()
  const course = courses.find(c=>c.id===plan.courseId)!

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [week, setWeek] = useState<number|''>('')
  const [evlOutcomeIds, setEvlOutcomeIds] = useState<string[]>([])
  const [caseIds, setCaseIds] = useState<string[]>([])
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>([])
  const [vraak, setVraak] = useState({ variatie:3, relevantie:3, authenticiteit:3, actualiteit:3, kwantiteit:3 })

  const evlExcluded = course?.evlOverrides?.EVL1 || []
  const evlForCourse = useMemo(()=> evl.map(b => b.id==='EVL1' ? ({...b, outcomes: b.outcomes.filter(o=>!evlExcluded.includes(o.id))}) : b), [evl])

  function toggle<T extends string>(arr: T[], v: T, set:(x:T[])=>void){
    set(arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v])
  }

  function save(){
    if(!name.trim()) return alert('Naam is verplicht')
    if(!week || Number(week) <= 0) return alert('Week is verplicht')
    const artifact: Artifact = {
      id: generateId('art'), name: name.trim(), week: Number(week), evlOutcomeIds, caseIds, knowledgeIds, vraak,
      createdAt: Date.now(), updatedAt: Date.now()
    }
    const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
    const idx = plans.findIndex(p=>p.id===plan.id)
    if(idx>=0){
      plans[idx] = { ...plans[idx], artifacts: [artifact, ...plans[idx].artifacts] }
      writeJson(LS_KEYS.plans, plans)
      onSaved(artifact)
      onClose()
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={e=>e.stopPropagation()}>
        <h3>Bewijsstuk toevoegen</h3>
        <div className="muted" style={{marginBottom:8}}>Stap {step} van 5</div>

        {step===1 && (
          <div className="grid" style={{gridTemplateColumns:'1fr 180px'}}>
            <label><span>Naam</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="bijv. e-learning certificaat"/></label>
            <label><span>Week</span><input type="number" min={1} max={53} value={week} onChange={e=>setWeek(e.target.value as any)} /></label>
          </div>
        )}

        {step===2 && (
          <div>
            <h4>EVL leeruitkomsten</h4>
            {evlForCourse.map(b=> (
              <div key={b.id} style={{marginTop:8}}>
                <div className="evl-title">{b.id} · {b.name}</div>
                <div className="luk">
                  {b.outcomes.map(o=> (
                    <label key={o.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                      <input type="checkbox" checked={evlOutcomeIds.includes(o.id)} onChange={()=>toggle(evlOutcomeIds,o.id,setEvlOutcomeIds)} /> {o.id}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step===3 && (
          <div>
            <h4>Casussen</h4>
            <div className="luk">
              {course.cases.map(c=> (
                <label key={c.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                  <input type="checkbox" checked={caseIds.includes(c.id)} onChange={()=>toggle(caseIds,c.id,setCaseIds)} /> {c.name}
                </label>
              ))}
            </div>
            <h4>Kennisdomeinen</h4>
            <div className="luk">
              {course.knowledgeDomains.map(k=> (
                <label key={k.id} style={{display:'inline-flex',gap:6,marginRight:12}}>
                  <input type="checkbox" checked={knowledgeIds.includes(k.id)} onChange={()=>toggle(knowledgeIds,k.id,setKnowledgeIds)} /> {k.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {step===4 && (
          <div className="grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
            {(['variatie','relevantie','authenticiteit','actualiteit','kwantiteit'] as const).map(k => (
              <label key={k}><span>{k}</span>
                <input type="range" min={1} max={5} value={vraak[k]} onChange={e=>setVraak({ ...vraak, [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
        )}

        {step===5 && (
          <div>
            <h4>Controle</h4>
            <div className="muted">Naam: {name || '—'} · Week: {week || '—'}</div>
            <div className="muted">LUK: {evlOutcomeIds.join(', ') || '—'}</div>
            <div className="muted">Casus: {caseIds.length||'—'} · Kennis: {knowledgeIds.length||'—'}</div>
          </div>
        )}

        <div className="dialog-actions">
          {step>1 ? <button onClick={()=>setStep(step-1)}>Terug</button> : <button onClick={onClose}>Annuleren</button>}
          {step<5 ? <button onClick={()=>setStep(step+1)}>Volgende</button> : <button onClick={save}>Opslaan</button>}
        </div>
      </div>
    </div>
  )
}


