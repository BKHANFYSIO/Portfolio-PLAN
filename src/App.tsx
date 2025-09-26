import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { LS_KEYS, readJson, writeJson, generateId } from './lib/storage'
import type { PortfolioPlan } from './lib/storage'
import { ensureSeed, getCurriculumForYear, getYears } from './lib/curriculum'
import { Link } from 'react-router-dom'
import { applyTheme, getThemeSetting, setThemeSetting } from './lib/theme'
import BackupDialog from './components/BackupDialog'
import RestoreDialog from './components/RestoreDialog'

function App() {
  const [plans, setPlans] = useState<PortfolioPlan[]>([])
  const years = useMemo(()=>getYears(), [])
  // getCurriculum blijft als fallback via getCurriculumForYear gebruikt; geen directe referentie hier nodig
  const [showDialog, setShowDialog] = useState(false)

  function formatStudyYearLabel(startYear: number, mode: 'short'|'long' = 'short'){
    const endYear = startYear + 1
    if(mode==='long') return `${startYear}-${endYear}`
    const s1 = String(startYear).slice(-2)
    const s2 = String(endYear).slice(-2)
    return `${s1}-${s2}`
  }

  function getDefaultStudyStartYear(): number{
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), 7, 14) // 14 aug (maandindex 7)
    return (now < cutoff) ? (now.getFullYear()-1) : now.getFullYear()
  }

  const defaultYear = useMemo(()=>{
    const desired = getDefaultStudyStartYear()
    const available = years.map(y=>y.year)
    if(available.includes(desired)) return desired
    const sorted = [...available].sort((a,b)=> a-b)
    if(sorted.length===0) return 2025
    const ge = sorted.find(y=> y>=desired)
    return ge!=null ? ge : sorted[sorted.length-1]
  }, [years])

  const [form, setForm] = useState({ name: '', year: defaultYear, courseId: '', periodType: 'periode', periodPeriode: '1', periodSemester: '1', periodStartWeek: '', periodEndWeek: '' })

  const currentCurriculum = useMemo(()=> getCurriculumForYear(form.year), [form.year])
  const selectedCourse = useMemo(()=> currentCurriculum.courses.find(c=>c.id===form.courseId) || currentCurriculum.courses[0], [currentCurriculum, form.courseId])
  const computedTitle = useMemo(()=>{
    const base = selectedCourse?.name || ''
    const extra = (form.name||'').trim()
    return extra ? `${base} - ${extra}` : base
  }, [selectedCourse, form.name])
  const isDuplicateTitle = useMemo(()=> plans.some(p=> (p.name||'').trim().toLowerCase() === computedTitle.trim().toLowerCase()), [plans, computedTitle])

  // Zorg dat courseId default gezet wordt op eerste beschikbare cursus in gekozen jaar
  useEffect(()=>{
    const firstId = currentCurriculum.courses[0]?.id || ''
    if(form.courseId!==firstId){ setForm(prev=> ({ ...prev, courseId: firstId })) }
  }, [currentCurriculum])

  // Debug: toon in dev de beschikbare cursussen voor geselecteerd jaar
  useEffect(()=>{
    try{
      if((import.meta as any).env?.DEV){
        // eslint-disable-next-line no-console
        console.log('[ui] year', form.year, 'courses', currentCurriculum.courses.map(c=>c.name))
      }
    }catch{}
  }, [form.year, currentCurriculum])
  const [showBackup, setShowBackup] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  type UiPrefs = { sortBy: 'alpha'|'created'|'updated'; sortDir: 'asc'|'desc' }
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(()=> readJson<UiPrefs>(LS_KEYS.ui, { sortBy: 'updated', sortDir: 'desc' }))

  useEffect(()=>{
    ensureSeed();
    const fromLs = readJson(LS_KEYS.plans, [] as PortfolioPlan[])
    // migreer oudere entries zonder timestamps/favorite
    const now = Date.now()
    const migrated = fromLs.map(p => ({
      ...p,
      createdAt: (p as any).createdAt ?? now,
      updatedAt: (p as any).updatedAt ?? now,
      favorite: (p as any).favorite ?? false,
    })) as PortfolioPlan[]
    setPlans(migrated)
    // schrijf terug indien er veld ontbrak
    const changed = migrated.some((p,i)=> p !== fromLs[i])
    if(changed) writeJson(LS_KEYS.plans, migrated)
  }, [])
  useEffect(()=>{ applyTheme() }, [])
  // Eerste bezoek: uitleg tonen
  useEffect(()=>{
    const seen = readJson<boolean>(LS_KEYS.help, false)
    if(!seen){
      setShowHelp(true)
      writeJson(LS_KEYS.help, true)
    }
  }, [])

  function save(pls: PortfolioPlan[]){ setPlans(pls); writeJson(LS_KEYS.plans, pls); }
  function savePrefs(next: UiPrefs){ setUiPrefs(next); writeJson(LS_KEYS.ui, next) }
  function remove(id: string){ save(plans.filter(p=>p.id!==id)) }

  function create(){
    const course = selectedCourse
    const finalName = computedTitle.trim()
    if(!finalName){ return alert('Titel is verplicht.') }
    if(isDuplicateTitle){ return alert('Er bestaat al een portfolio plan met deze titel.') }
    let period: PortfolioPlan['period'];
    if(form.periodType==='periode') period = { type:'periode', value:Number(form.periodPeriode), label:`Periode ${form.periodPeriode}` };
    else if(form.periodType==='semester') period = { type:'semester', value:Number(form.periodSemester), label:`Semester ${form.periodSemester}` };
    else period = { type:'maatwerk', value:[Number(form.periodStartWeek), Number(form.periodEndWeek)], label:`Maatwerk weeks ${form.periodStartWeek}-${form.periodEndWeek}` };
    const now = Date.now()
    const plan: PortfolioPlan = { id: generateId('plan'), name: finalName, year: Number(form.year), courseId: course.id, courseName: course.name, period, artifacts: [], createdAt: now, updatedAt: now, favorite: false };
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
    applyTheme()
  }

  function toggleFavorite(id: string){
    const next = plans.map(p => p.id===id ? ({ ...p, favorite: !p.favorite }) : p)
    save(next)
  }

  function sorted(list: PortfolioPlan[]): PortfolioPlan[]{
    const { sortBy, sortDir } = uiPrefs
    const dir = sortDir==='asc' ? 1 : -1
    const clone = [...list]
    clone.sort((a,b)=>{
      if(sortBy==='alpha') return a.name.localeCompare(b.name) * dir
      if(sortBy==='created') return (((a.createdAt)||0) - ((b.createdAt)||0)) * dir
      return (((a.updatedAt)||0) - ((b.updatedAt)||0)) * dir
    })
    return clone
  }

  const favs = sorted(plans.filter(p=>p.favorite))
  const others = sorted(plans.filter(p=>!p.favorite))

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/Images/Logo-HAN.webp" alt="HAN" />
          <h1>Portfolio planner Fysiotherapie</h1>
        </div>
        <div className="actions">
          <button onClick={()=>setShowDialog(true)}>Nieuw portfolio plan</button>
          <button className="file-label" onClick={()=>setShowSettings(true)}>Instellingen</button>
          <button className="file-label" onClick={()=>setShowHelp(true)}>Uitleg</button>
        </div>
      </header>

      <section className="list">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 style={{margin:0}}>Mijn portfolio plannen</h2>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label className="muted" style={{fontSize:12}}>Sorteer op</label>
            <select value={uiPrefs.sortBy} onChange={e=> savePrefs({ ...uiPrefs, sortBy: e.target.value as UiPrefs['sortBy'] })} className="file-label">
              <option value="updated">Laatst bewerkt</option>
              <option value="created">Aangemaakt</option>
              <option value="alpha">Titel (A-Z)</option>
            </select>
            <select value={uiPrefs.sortDir} onChange={e=> savePrefs({ ...uiPrefs, sortDir: e.target.value as UiPrefs['sortDir'] })} className="file-label">
              <option value="desc">↧ aflopend</option>
              <option value="asc">↥ oplopend</option>
            </select>
          </div>
        </div>
        {plans.length===0 ? (
          <p className="muted">Nog geen plannen. Klik op “Nieuw portfolio plan”.</p>
        ) : (
          <ul>
            {favs.length>0 && <li className="row" style={{borderTop:'none'}}><div className="title">Favorieten</div></li>}
            {favs.map(p=> (
              <li key={p.id} className="row">
                <div className="meta">
                  <div className="title">{p.name}</div>
                  <div className="sub">{p.year} · {p.courseName} · {p.period.label} · aangemaakt {new Date(p.createdAt).toLocaleDateString()} · bewerkt {new Date(p.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="row-actions">
                  <Link className="file-label" to={`/plan/${p.id}`}>Bewerken</Link>
                  <button onClick={()=>toggleFavorite(p.id)}>{p.favorite ? '★' : '☆'}</button>
                  {/* PDF export verplaatst naar detailpagina */}
                  <button className="danger" onClick={()=>remove(p.id)}>Verwijderen</button>
                </div>
              </li>
            ))}
            {others.length>0 && favs.length>0 && <li className="row" style={{borderTop:'none'}}><div className="title">Overige</div></li>}
            {others.map(p=> (
              <li key={p.id} className="row">
                <div className="meta">
                  <div className="title">{p.name}</div>
                  <div className="sub">{p.year} · {p.courseName} · {p.period.label} · aangemaakt {new Date(p.createdAt).toLocaleDateString()} · bewerkt {new Date(p.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="row-actions">
                  <Link className="file-label" to={`/plan/${p.id}`}>Bewerken</Link>
                  <button onClick={()=>toggleFavorite(p.id)}>{p.favorite ? '★' : '☆'}</button>
                  {/* PDF export verplaatst naar detailpagina */}
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
                <span>Titel (aanvulling, optioneel)</span>
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="bijv. eigen focus of groep" />
              </label>
              <div className="muted" style={{gridColumn:'1 / -1', fontSize:12}}>
                Voorgestelde titel: <strong>{computedTitle||'—'}</strong> {isDuplicateTitle && (<span style={{color:'#f29696', marginLeft:8}}>(bestaat al)</span>)}
              </div>
              <label>
                <span>Studiejaar</span>
                <select value={form.year} onChange={e=>setForm({...form, year:Number(e.target.value)})}>
                  {years.map(y=> <option key={y.id} value={y.year}>{formatStudyYearLabel(y.year)}</option>)}
                </select>
              </label>
              <label>
                <span>Cursus</span>
                <select value={form.courseId} onChange={e=>setForm({...form, courseId:e.target.value})}>
                  {currentCurriculum.courses.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
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

      {showSettings && (
        <div className="dialog-backdrop" onClick={()=>setShowSettings(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <h3>Instellingen</h3>
            <div className="grid">
              <label>
                <span>Thema</span>
                <select value={theme} onChange={onThemeChange}>
                  <option value="system">Systeem</option>
                  <option value="dark">Donker</option>
                  <option value="light">Licht</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Backup</legend>
              <div className="row2">
                <button onClick={()=>{ setShowSettings(false); setShowBackup(true) }}>Backup maken</button>
                <button className="file-label" onClick={()=>{ setShowSettings(false); setShowRestore(true) }}>Backup terugzetten</button>
              </div>
            </fieldset>
            <div className="dialog-actions">
              <button onClick={()=>setShowSettings(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {showBackup && <BackupDialog onClose={()=>setShowBackup(false)} />}
      {showRestore && <RestoreDialog onClose={()=>setShowRestore(false)} onRestored={()=> setPlans(readJson(LS_KEYS.plans, [] as PortfolioPlan[])) } />}
      {showHelp && (
        <div className="dialog-backdrop" onClick={()=>setShowHelp(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <div style={{background:'rgba(79,124,255,.15)', border:'1px solid rgba(79,124,255,.35)', color:'var(--text)', padding:10, borderRadius:8, marginBottom:10}}>
              Dit venster verschijnt alleen bij je eerste bezoek. Je kunt het altijd later terugvinden via de knop ‘Uitleg’.
            </div>
            <h3>Uitleg</h3>
            <div style={{display:'grid', gap:8}}>
              <p>Deze app is een hulpmiddel om tot een portfolio plan te komen. Je mag het ook op je eigen manier doen.</p>
              <p>Het is verstandig om bij de start van een cursus een portfolio plan te maken, dat in je eJournal bij EVL4 te plaatsen, feedback te vragen in een gesprek met een medestudent of docent en daarop te reflecteren.</p>
              <p>Je plannen worden lokaal op je eigen device in de browser opgeslagen. Maak regelmatig een backup via Instellingen om dataverlies te voorkomen.</p>
              <p>Omdat gegevens lokaal zijn opgeslagen, kan niemand bij jouw plan tenzij je het deelt met je docenten.</p>
              <p>Belangrijk: streef naar een portfolio plan waarbij de geplande datapunten als geheel goed scoren op de VRAAK-criteria.</p>
            </div>
            <div className="dialog-actions">
              <button onClick={()=>setShowHelp(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
