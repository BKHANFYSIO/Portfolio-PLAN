import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LS_KEYS, readJson, writeJson } from '../lib/storage'
import { getCurriculum, getYears } from '../lib/curriculum'
import './planDetail.css'
import AddArtifactDialog from '../components/AddArtifactDialog'
import WeekMatrix from '../components/WeekMatrix'

export default function PlanDetail(){
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const plans = readJson(LS_KEYS.plans, [] as any[])
  const plan = plans.find(p=>p.id===id)
  const years = getYears()
  const { evl, courses } = getCurriculum()
  const initialEdit = params.get('edit') === '1'
  const [isEdit, setIsEdit] = useState(initialEdit)
  const [dirty, setDirty] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [localName, setLocalName] = useState(plan?.name || '')
  const [showList, setShowList] = useState(false)
  if(!plan){
    return (
      <div style={{padding:20}}>
        <p>Plan niet gevonden.</p>
        <Link to="/">Terug</Link>
      </div>
    )
  }

  const course = courses.find(c=>c.id===plan.courseId)
  const evlExcluded = course?.evlOverrides?.EVL1 || []
  const evlForCourse = evl.map(block => block.id==='EVL1' ? ({
    ...block,
    outcomes: block.outcomes.filter(o=> !evlExcluded.includes(o.id))
  }) : block)

  // placeholder timelineWeeks verwijderd (niet gebruikt)

  function toggleEdit(){
    const next = !isEdit
    setIsEdit(next)
    const p = new URLSearchParams(params)
    if(next) p.set('edit','1'); else p.delete('edit')
    setParams(p, { replace:true })
  }

  function onCancel(){
    if(dirty && !confirm('Wijzigingen niet opgeslagen. Toch annuleren?')) return
    setIsEdit(false)
    const p = new URLSearchParams(params); p.delete('edit'); setParams(p,{replace:true})
    setDirty(false)
  }

  function onSave(){
    // Sla plan-naam en eventueel andere lokale wijzigingen op
    const plans = readJson(LS_KEYS.plans, [] as any[])
    const idx = plans.findIndex((p:any)=>p.id===plan.id)
    if(idx>=0){
      plans[idx] = { ...plans[idx], name: localName }
      writeJson(LS_KEYS.plans, plans)
    }
    setIsEdit(false)
    const p = new URLSearchParams(params); p.delete('edit'); setParams(p,{replace:true})
    setDirty(false)
  }

  return (
    <div className="detail">
      <header className="detail-header">
        <div>
          {!isEdit ? (
            <h1>{localName}</h1>
          ) : (
            <input value={localName} onChange={e=>{ setLocalName(e.target.value); setDirty(true) }} style={{fontSize:20,padding:8,borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'transparent',color:'inherit'}} />
          )}
          <div className="muted">{plan.year} · {plan.courseName} · {plan.period.label}</div>
        </div>
        <div className="actions">
          <Link className="btn" to="/">Terug</Link>
          <button className="btn" onClick={()=>setShowList(true)}>Alle bewijsstukken</button>
          {!isEdit && <button className="btn" onClick={toggleEdit}>Bewerken</button>}
          {isEdit && <>
            <button className="btn" onClick={onSave}>Opslaan</button>
            <button className="btn" onClick={onCancel}>Annuleren</button>
          </>}
        </div>
      </header>

      <section className="layout">
        <main className="center">
          {isEdit && <div style={{marginTop:12}}>
            <button className="btn" onClick={()=>setShowAdd(true)}>Bewijsstuk toevoegen</button>
          </div>}
          <h3 style={{marginTop:16}}>Matrix (LUK x weken)</h3>
          <WeekMatrix plan={{...plan, name: localName}} />
        </main>
      </section>

      {showAdd && <AddArtifactDialog plan={{...plan, name: localName}} onClose={()=>setShowAdd(false)} onSaved={()=>setDirty(false)} />}
      {showList && (
        <div className="modal-backdrop" onClick={()=>setShowList(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Alle bewijsstukken</h3>
            {plan.artifacts && plan.artifacts.length>0 ? (
              <ul>
                {plan.artifacts.sort((a:any,b:any)=>a.week-b.week).map((a:any)=> (
                  <li key={a.id} style={{padding:'6px 0'}}>W{a.week}: {a.name}</li>
                ))}
              </ul>
            ) : (
              <div className="muted small">Nog geen bewijsstukken.</div>
            )}
            <div style={{marginTop:12, textAlign:'right'}}>
              <button className="btn" onClick={()=>setShowList(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


