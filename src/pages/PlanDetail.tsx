import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { PortfolioPlan } from '../lib/storage'
import './planDetail.css'
import AddArtifactDialog from '../components/AddArtifactDialog'
import WeekMatrix from '../components/WeekMatrix'

export default function PlanDetail(){
  const { id } = useParams()
  const plans = readJson(LS_KEYS.plans, [] as any[])
  const plan = plans.find(p=>p.id===id)
  // verwijderde curriculum/year reads (niet nodig op deze pagina)
  const [showAdd, setShowAdd] = useState(false)
  const [localName, setLocalName] = useState(plan?.name || '')
  const [localPeriod, setLocalPeriod] = useState<PortfolioPlan['period']>(plan?.period)
  const [showList, setShowList] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: plan?.name || '',
    periodType: (plan?.period?.type as 'periode'|'semester'|'maatwerk') || 'periode',
    periodPeriode: String(plan?.period?.type==='periode' ? plan?.period?.value : 1),
    periodSemester: String(plan?.period?.type==='semester' ? plan?.period?.value : 1),
    periodStartWeek: String(plan?.period?.type==='maatwerk' ? (plan?.period?.value as number[])[0] : ''),
    periodEndWeek: String(plan?.period?.type==='maatwerk' ? (plan?.period?.value as number[])[1] : ''),
  })
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
      plans[idx] = { ...plans[idx], name: editForm.name.trim() || 'Naamloos', period: nextPeriod, updatedAt: Date.now() }
      writeJson(LS_KEYS.plans, plans)
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
          <WeekMatrix plan={{...plan, name: localName, period: localPeriod}} />
        </main>
      </section>

      {showAdd && <AddArtifactDialog plan={{...plan, name: localName}} onClose={()=>setShowAdd(false)} onSaved={()=>{}} />}
      {showEdit && (
        <div className="modal-backdrop" onClick={()=>setShowEdit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Plan bewerken</h3>
            <div className="grid">
              <label>
                <span>Naam</span>
                <input value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} />
              </label>
            </div>
            <fieldset>
              <legend>Periode</legend>
              <div className="radio">
                <label><input type="radio" checked={editForm.periodType==='periode'} onChange={()=>setEditForm({...editForm, periodType:'periode'})}/> Periode</label>
                <label><input type="radio" checked={editForm.periodType==='semester'} onChange={()=>setEditForm({...editForm, periodType:'semester'})}/> Semester</label>
                <label><input type="radio" checked={editForm.periodType==='maatwerk'} onChange={()=>setEditForm({...editForm, periodType:'maatwerk'})}/> Maatwerk</label>
              </div>
              {editForm.periodType==='periode' && (
                <label>
                  <span>Periode</span>
                  <select value={editForm.periodPeriode} onChange={e=>setEditForm({...editForm, periodPeriode:e.target.value})}>
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
                  <select value={editForm.periodSemester} onChange={e=>setEditForm({...editForm, periodSemester:e.target.value})}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>
              )}
              {editForm.periodType==='maatwerk' && (
                <div className="row2">
                  <label><span>Startweek</span><input type="number" value={editForm.periodStartWeek} onChange={e=>setEditForm({...editForm, periodStartWeek:e.target.value})}/></label>
                  <label><span>Eindweek</span><input type="number" value={editForm.periodEndWeek} onChange={e=>setEditForm({...editForm, periodEndWeek:e.target.value})}/></label>
                </div>
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


