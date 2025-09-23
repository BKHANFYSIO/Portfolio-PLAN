import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { LS_KEYS, readJson, writeJson, generateId } from './lib/storage'
import type { PortfolioPlan } from './lib/storage'
import { ensureSeed, getCurriculum, getYears } from './lib/curriculum'
import { Link } from 'react-router-dom'
import { applyTheme, getThemeSetting, setThemeSetting } from './lib/theme'
import BackupDialog from './components/BackupDialog'
import RestoreDialog from './components/RestoreDialog'

function App() {
  const [plans, setPlans] = useState<PortfolioPlan[]>([])
  const years = useMemo(()=>getYears(), [])
  const curriculum = useMemo(()=>getCurriculum(), [])
  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState({ name: '', year: years[0]?.year ?? 2025, courseId: curriculum.courses[0]?.id ?? '', periodType: 'periode', periodPeriode: '1', periodSemester: '1', periodStartWeek: '', periodEndWeek: '' })
  const [showBackup, setShowBackup] = useState(false)
  const [showRestore, setShowRestore] = useState(false)

  useEffect(()=>{ ensureSeed(); setPlans(readJson(LS_KEYS.plans, [] as PortfolioPlan[])) }, [])
  useEffect(()=>{ applyTheme() }, [])

  function save(pls: PortfolioPlan[]){ setPlans(pls); writeJson(LS_KEYS.plans, pls); }
  function remove(id: string){ save(plans.filter(p=>p.id!==id)) }

  function create(){
    if(!form.name.trim()) return alert('Naam is verplicht.');
    const course = curriculum.courses.find(c=>c.id===form.courseId) || curriculum.courses[0];
    let period: PortfolioPlan['period'];
    if(form.periodType==='periode') period = { type:'periode', value:Number(form.periodPeriode), label:`Periode ${form.periodPeriode}` };
    else if(form.periodType==='semester') period = { type:'semester', value:Number(form.periodSemester), label:`Semester ${form.periodSemester}` };
    else period = { type:'maatwerk', value:[Number(form.periodStartWeek), Number(form.periodEndWeek)], label:`Maatwerk weeks ${form.periodStartWeek}-${form.periodEndWeek}` };
    const plan: PortfolioPlan = { id: generateId('plan'), name: form.name.trim(), year: Number(form.year), courseId: course.id, courseName: course.name, period, artifacts: [] };
    save([plan, ...plans]);
    setShowDialog(false);
    setForm({ ...form, name: '' });
  }

  // Simple theme switch in header for now (settings dialog komt hierna)
  const [theme, setTheme] = useState(getThemeSetting())
  function onThemeChange(e: React.ChangeEvent<HTMLSelectElement>){
    const v = e.target.value as any
    setTheme(v)
    setThemeSetting(v)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Portfolio Plan Fysiotherapie</h1>
        <div className="actions">
          <select value={theme} onChange={onThemeChange} className="file-label">
            <option value="system">Systeem</option>
            <option value="dark">Donker</option>
            <option value="light">Licht</option>
          </select>
          <button onClick={()=>setShowDialog(true)}>Nieuw portfolio plan</button>
          <button onClick={()=>setShowBackup(true)}>Backup maken</button>
          <button className="file-label" onClick={()=>setShowRestore(true)}>Backup terugzetten</button>
        </div>
      </header>

      <section className="list">
        <h2>Mijn portfolio plannen</h2>
        {plans.length===0 ? (
          <p className="muted">Nog geen plannen. Klik op “Nieuw portfolio plan”.</p>
        ) : (
          <ul>
            {plans.map(p=> (
              <li key={p.id} className="row">
                <div className="meta">
                  <div className="title">{p.name}</div>
                  <div className="sub">{p.year} · {p.courseName} · {p.period.label}</div>
                </div>
                <div className="row-actions">
                  <Link className="file-label" to={`/plan/${p.id}`}>Bewerken</Link>
                  <button onClick={()=>alert('PDF volgt')}>PDF</button>
                  <button className="danger" onClick={()=>remove(p.id)}>Verwijderen</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showDialog && (
        <div className="dialog-backdrop" onClick={()=>setShowDialog(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <h3>Nieuw portfolio plan</h3>
            <div className="grid">
              <label>
                <span>Naam</span>
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              </label>
              <label>
                <span>Studiejaar</span>
                <select value={form.year} onChange={e=>setForm({...form, year:Number(e.target.value)})}>
                  {years.map(y=> <option key={y.id} value={y.year}>{y.year}</option>)}
                </select>
              </label>
              <label>
                <span>Cursus</span>
                <select value={form.courseId} onChange={e=>setForm({...form, courseId:e.target.value})}>
                  {curriculum.courses.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Periode</legend>
              <div className="radio">
                <label><input type="radio" checked={form.periodType==='periode'} onChange={()=>setForm({...form, periodType:'periode'})}/> Periode</label>
                <label><input type="radio" checked={form.periodType==='semester'} onChange={()=>setForm({...form, periodType:'semester'})}/> Semester</label>
                <label><input type="radio" checked={form.periodType==='maatwerk'} onChange={()=>setForm({...form, periodType:'maatwerk'})}/> Maatwerk</label>
              </div>
              {form.periodType==='periode' && (
                <label>
                  <span>Periode</span>
                  <select value={form.periodPeriode} onChange={e=>setForm({...form, periodPeriode:e.target.value})}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </label>
              )}
              {form.periodType==='semester' && (
                <label>
                  <span>Semester</span>
                  <select value={form.periodSemester} onChange={e=>setForm({...form, periodSemester:e.target.value})}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>
              )}
              {form.periodType==='maatwerk' && (
                <div className="row2">
                  <label><span>Startweek</span><input type="number" value={form.periodStartWeek} onChange={e=>setForm({...form, periodStartWeek:e.target.value})}/></label>
                  <label><span>Eindweek</span><input type="number" value={form.periodEndWeek} onChange={e=>setForm({...form, periodEndWeek:e.target.value})}/></label>
                </div>
              )}
            </fieldset>
            <div className="dialog-actions">
              <button onClick={()=>setShowDialog(false)}>Annuleren</button>
              <button onClick={create}>Aanmaken</button>
            </div>
          </div>
        </div>
      )}

      {showBackup && <BackupDialog onClose={()=>setShowBackup(false)} />}
      {showRestore && <RestoreDialog onClose={()=>setShowRestore(false)} onRestored={()=> setPlans(readJson(LS_KEYS.plans, [] as PortfolioPlan[])) } />}
    </div>
  )
}

export default App
