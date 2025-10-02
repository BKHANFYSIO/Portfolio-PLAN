import { useEffect, useMemo, useRef, useState } from 'react'
// import GuidancePanel from '../components/GuidancePanel'
import GuidanceInline from '../components/GuidanceInline'
import GuidanceFloat from '../components/GuidanceFloat'
import InfoTip from '../components/InfoTip'
import { generateId, LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { Artifact, PortfolioPlan } from '../lib/storage'
import type { EvidenceAgeBracket } from '../lib/storage'
import type { PerspectiveKey } from '../lib/storage'
import { getCurriculumForYear, getYears } from '../lib/curriculum'
import { VRAAK_META } from '../lib/guidance'

type Props = {
  plan: PortfolioPlan;
  onClose: ()=>void;
  onSaved: (a:Artifact)=>void;
  initialWeek?: number;
  initialEvlOutcomeId?: string;
  initialCaseId?: string;
  initialKnowledgeId?: string;
}

export default function AddArtifactDialog({ plan, onClose, onSaved, initialWeek, initialEvlOutcomeId, initialCaseId, initialKnowledgeId }: Props){
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
  const [vraak, setVraak] = useState({ variatie:0, relevantie:0, authenticiteit:0, actualiteit:0, kwantiteit:0 })
  const [kind, setKind] = useState<string>('')
  const [occAge, setOccAge] = useState<EvidenceAgeBracket|''>('')
  const [persp, setPersp] = useState<PerspectiveKey[]>([])
  const [noPersp, setNoPersp] = useState<boolean>(false)
  const [note, setNote] = useState('')
  const [focusKey, setFocusKey] = useState<'step:name'|'step:week'|'step:kind'|'step:persp'|'step:note'|'step:rel'|'step:auth'|'step:actual'|null>(null)
  const [fullHelpKey, setFullHelpKey] = useState<null|'name'|'week'|'kind'|'persp'|'evl'|'rel'|'auth'|'actual'>(null)
  const nameRef = useRef<HTMLInputElement|null>(null)
  const weekRef = useRef<HTMLSelectElement|null>(null)
  const kindRef = useRef<HTMLSelectElement|null>(null)
  const perspGroupRef = useRef<HTMLDivElement|null>(null)
  const noteRef = useRef<HTMLTextAreaElement|null>(null)

  const defaultVraak = { variatie:0, relevantie:0, authenticiteit:0, actualiteit:0, kwantiteit:0 }
  const isDirty = useMemo(()=>{
    const anyArrays = evlOutcomeIds.length>0 || caseIds.length>0 || knowledgeIds.length>0 || persp.length>0
    const anyBasics = Boolean(name.trim() || week || kind || note.trim())
    const modeChosen = startChoice!=='' || chosenTemplate!==''
    const vraakChanged = JSON.stringify(vraak)!==JSON.stringify(defaultVraak)
    return anyArrays || anyBasics || modeChosen || vraakChanged
  }, [name, week, kind, note, evlOutcomeIds, caseIds, knowledgeIds, persp, startChoice, chosenTemplate, vraak])

  function confirmClose(){
    if(isDirty){
      const ok = confirm('Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt sluiten? Wijzigingen worden niet opgeslagen.')
      if(!ok) return
    }
    onClose()
  }
  function applyTemplateByName(name: string){
    const t = templates.find(x=> x.name===name)
    if(!t) return
    setName(t.name)
    setEvlOutcomeIds([...(t.evl||[])])
    setCaseIds([...(t.cases||[])])
    setKnowledgeIds([...(t.knowledge||[])])
    setVraak({ ...(t.vraak||{ variatie:0, relevantie:0, authenticiteit:0, actualiteit:0, kwantiteit:0 }) })
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

  // Prefill vanuit matrix-klik
  useEffect(()=>{
    if(initialWeek){ setWeek(initialWeek) }
    if(initialEvlOutcomeId){ setEvlOutcomeIds([initialEvlOutcomeId]) }
    if(initialCaseId){ setCaseIds([initialCaseId]) }
    if(initialKnowledgeId){ setKnowledgeIds([initialKnowledgeId]) }
  }, [initialWeek, initialEvlOutcomeId, initialCaseId, initialKnowledgeId])

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
      note: note.trim() || undefined,
      occurrenceAge: occAge || undefined,
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
    <div className="dialog-backdrop" onClick={confirmClose}>
      <div className="dialog" onClick={e=>e.stopPropagation()}>
        <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <h3 style={{margin:0}}>Bewijsstuk toevoegen</h3>
          <button className="wm-smallbtn" onClick={confirmClose}>Sluiten</button>
        </div>
        {step===0 && (
        <div style={{display:'flex', gap:8, marginTop:10, marginBottom:8}} className="toggle-group">
          <button
            className={`file-label toggle${mode==='wizard' ? ' active' : ''}`}
            aria-pressed={mode==='wizard'}
            onClick={()=>{ setMode('wizard'); setStep(0); setStartChoice(''); setChosenTemplate(''); localStorage.setItem('pf-add-mode','wizard') }}
          >Stappen</button>
          <button
            className={`file-label toggle${mode==='full' ? ' active' : ''}`}
            aria-pressed={mode==='full'}
            onClick={()=>{ setMode('full'); setStep(0); setStartChoice(''); setChosenTemplate(''); localStorage.setItem('pf-add-mode','full') }}
          >Formulier</button>
        </div>
        )}
        {step===0 && (
        <div className="muted" style={{marginTop:-4, marginBottom:8, fontSize:12}}>
          {mode==='wizard' ? (
              <>Je doorloopt duidelijke stappen met uitleg, voorbeelden en een korte checklist. Zo bouw je doelgericht een sterk bewijsstuk. Alles blijft later aanpasbaar.</>
          ) : (
            <>Vul alle velden in één overzichtelijk formulier in. Snel als je precies weet wat je wilt toevoegen.</>
          )}
        </div>
        )}
        {mode==='wizard' && <div className="muted" style={{marginBottom:8}}>Stap {step+1} van {TOTAL_STEPS}</div>}
        {mode==='wizard' && step===1 && (
          <div style={{marginTop:-4, marginBottom:8}}>
            <aside style={{
              background:'linear-gradient(180deg, rgba(255,184,76,.10), transparent)',
              border:'1px solid rgba(255,184,76,.6)',
              borderRadius:8, padding:10, fontSize:12
            }}>
              Selecteer een veld. Onder het veld verschijnt uitleg die je helpt bij het maken van een sterk portfolio‑plan.
            </aside>
          </div>
        )}

        {mode==='wizard' && step===0 && (
          <div>
            <h4>Startoptie</h4>
            <div style={{display:'grid', gap:8}}>
              <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                <input type="radio" checked={startChoice==='template'} onChange={()=>{ setStartChoice('template') }} /> Sjabloon gebruiken
              </label>
              <div className="muted" style={{fontSize:12, paddingLeft:22}}>
                Het sjabloon vult een aantal velden alvast in. Je kunt alles later nog aanpassen. Let op: niet alle (verplichte) velden zijn vooraf ingevuld.
              </div>
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
                  {Boolean(chosenTemplate) && (
                    <aside style={{marginTop:8, background:'linear-gradient(180deg, rgba(255,184,76,.10), transparent)', border:'1px solid rgba(255,184,76,.6)', borderRadius:8, padding:8, fontSize:12}}>
                      <div style={{fontWeight:600, marginBottom:4}}>Toelichting sjabloon</div>
                      <div>{(templates.find(x=>x.name===chosenTemplate)?.note) || 'Geen toelichting beschikbaar bij dit sjabloon.'}</div>
                    </aside>
                  )}
                </div>
              )}
              <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                <input type="radio" checked={startChoice==='free'} onChange={()=>{ setStartChoice('free') }} /> Vrije invoer
              </label>
                <div className="muted" style={{fontSize:12, paddingLeft:22}}>
                Je bepaalt zelf alle velden: naam, soort bewijs, leeruitkomsten en VRAAK‑criteria. Kies dit als je iets wilt toevoegen dat niet in een sjabloon past.
                </div>
            </div>
          </div>
        )}

        {mode==='wizard' && step===1 && (
          <div className="grid" style={{gridTemplateColumns:'1fr 180px'}}>
            {/* Inline uitleg onder actieve velden */}
            <label><span>Naam (verplicht)</span>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <input ref={nameRef} value={name} onChange={e=>setName(e.target.value)} placeholder="bijv. e-learning certificaat" onFocus={()=>setFocusKey('step:name')}/>
                <InfoTip content="Kies een specifieke, herkenbare titel. Vermijd vage namen." />
              </div>
            </label>
            {focusKey==='step:name' && (
              <GuidanceFloat entryKey="step:name" anchorEl={nameRef.current} containerEl={document.querySelector('.dialog') as HTMLElement} fixedTop={112} extraNote={startChoice==='template' ? 'Je koos voor een sjabloon: velden zoals naam of soort kunnen al ingevuld zijn. Je kunt deze altijd aanpassen.' : undefined} onRequestClose={()=> setFocusKey(null)} />
            )}
            <label><span>Week (verplicht)</span>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
              <select ref={weekRef} value={week} onChange={e=>setWeek(Number(e.target.value) as any)} onFocus={()=>setFocusKey('step:week')}>
                <option value="">Kies week…</option>
                {yearWeeks.filter(w=> visibleWeeks.includes(w.week)).map(w => {
                  const label = `${w.code||w.label}${w.startISO ? ' — '+w.startISO : ''}`
                  return <option key={w.week} value={w.week}>{label}</option>
                })}
              </select>
              <InfoTip content="Spreid bewijs over de tijd; week kun je later aanpassen of verslepen." />
              </div>
            </label>
            {focusKey==='step:week' && (
              <GuidanceFloat entryKey="step:week" anchorEl={weekRef.current} containerEl={document.querySelector('.dialog') as HTMLElement} forcePlacement={'left'} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
            )}
            <label><span>Soort (verplicht)</span>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
              <select ref={kindRef} value={kind} onChange={e=>setKind(e.target.value)} onFocus={()=>setFocusKey('step:kind')}>
                <option value="">Kies soort…</option>
                <option value="certificaat">Certificaat</option>
                <option value="schriftelijk">Schriftelijk product</option>
                <option value="kennistoets">Kennistoets</option>
                <option value="vaardigheid">Vaardigheidstest</option>
                <option value="performance">Performance</option>
                <option value="gesprek">Gesprek</option>
                <option value="overig">Overig</option>
              </select>
              <InfoTip content="Mix van soorten maakt je portfolio sterker; elk type heeft voor- en nadelen." />
              </div>
            </label>
            {focusKey==='step:kind' && (
              <GuidanceFloat entryKey="step:kind" anchorEl={kindRef.current} containerEl={document.querySelector('.dialog') as HTMLElement} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
            )}
            {/* sjabloonselect is verplaatst naar stap 0; in full-mode blijft hij beschikbaar */}
            <div style={{gridColumn:'1 / -1'}} role="group" aria-label="Perspectieven" ref={perspGroupRef}>
              <span>Perspectieven (verplicht, meerdere mogelijk)</span>
              <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                <label style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                  <input type="checkbox" checked={noPersp} onChange={()=>{ setNoPersp(v=>{ const nv = !v; if(nv){ setPersp([]) } return nv }) }} /> geen perspectieven
                </label>
                {(['zelfreflectie','docent','student-p','student-hf1','student-hf2-3','stagebegeleider','patient','overig'] as PerspectiveKey[]).map(p => (
                  <label key={p} style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                    <input
                      type="checkbox"
                      checked={persp.includes(p)}
                      onChange={()=> {
                        setNoPersp(false)
                        setPersp(s=> s.includes(p) ? s.filter(x=>x!==p) : [...s,p])
                        setTimeout(()=> setFocusKey('step:persp'), 0)
                      }}
                    /> {p}
                  </label>
                ))}
              </div>
            </div>
            {focusKey==='step:persp' && (
              <GuidanceFloat entryKey="step:persp" anchorEl={perspGroupRef.current} containerEl={document.querySelector('.dialog') as HTMLElement} forcePlacement={'bottom'} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
            )}
            <label style={{gridColumn:'1 / -1'}}>
              <span>Extra toelichting (optioneel)</span>
              <textarea ref={noteRef} value={note} onChange={e=> setNote(e.target.value)} onFocus={()=>setFocusKey('step:note')} placeholder="Context, aanpak, bijzonderheden…" rows={4} />
            </label>
            {focusKey==='step:note' && (
              <GuidanceFloat entryKey="step:note" anchorEl={noteRef.current} containerEl={document.querySelector('.dialog') as HTMLElement} forcePlacement={'top'} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
            )}
          </div>
        )}

        {mode==='wizard' && step===2 && (
          <div>
            <div style={{marginBottom:8}}>
              <aside style={{
                background:'linear-gradient(180deg, rgba(255,184,76,.10), transparent)',
                border:'1px solid rgba(255,184,76,.6)',
                borderRadius:8, padding:10
              }}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                  <div style={{fontWeight:600}}>Uitleg</div>
                  <span className="wm-chip" title={`Van invloed op ${VRAAK_META.v.label} uit de VRAAK-criteria — ${VRAAK_META.v.description}`}>V</span>
                  <span className="wm-chip" title={`Van invloed op ${VRAAK_META.r.label} uit de VRAAK-criteria — ${VRAAK_META.r.description}`}>R</span>
                  <span className="wm-chip" title={`Van invloed op ${VRAAK_META.k.label} uit de VRAAK-criteria — ${VRAAK_META.k.description}`}>K</span>
                </div>
                <div style={{fontSize:12}}>
                  Kies één of meerdere leeruitkomsten bij één of meerdere EVL’s. Dit draagt bij aan Variatie en Relevantie binnen VRAAK. Uiteindelijk moet je portfolio alle EVL’s afdekken; voor Kwantiteit zijn vaak meerdere datapunten per EVL nodig.
                </div>
              </aside>
            </div>
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
            <div style={{marginBottom:8}}>
              <aside style={{
                background:'linear-gradient(180deg, rgba(255,184,76,.10), transparent)',
                border:'1px solid rgba(255,184,76,.6)',
                borderRadius:8, padding:10
              }}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                  <div style={{fontWeight:600}}>Uitleg</div>
                  <span className="wm-chip" title="Van invloed op Relevantie uit de VRAAK-criteria — Aansluiting op de leeruitkomst of casus.">R</span>
                  <span className="wm-chip" title="Van invloed op Variatie uit de VRAAK-criteria — Spreiding over contexten/casussen.">V</span>
                </div>
                <div style={{fontSize:12}}>
                  Koppel casussen/thema’s en kennisdomeinen om de inhoudelijke context en dekking zichtbaar te maken. Casussen tonen de situatie en waarom het bewijs relevant is; kennisdomeinen laten de kennisbasis zien.
                </div>
              </aside>
            </div>
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
              <div>
                {focusKey==='step:rel' && (
                  <GuidanceFloat entryKey="step:rel" anchorEl={document.activeElement as HTMLElement} containerEl={document.querySelector('.dialog') as HTMLElement} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
                )}
            <div style={{display:'grid', gridTemplateColumns:'1fr 220px', alignItems:'center', gap:12}}>
              <div>
                <div style={{fontWeight:600}}>Relevantie</div>
                    <div className="muted" style={{fontSize:12}}>Klik om een waarde te kiezen. Nog geen keuze = grijze balk.</div>
                  </div>
                  <input aria-label="Relevantie" type="range" min={0} max={5} value={vraak.relevantie} onChange={e=>setVraak({ ...vraak, relevantie: Number(e.target.value) })} onFocus={()=> setFocusKey('step:rel')} />
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 220px', alignItems:'center', gap:12}}>
              <div>
                <div style={{fontWeight:600}}>Authenticiteit</div>
                  <div className="muted" style={{fontSize:12}}>Klik om een waarde te kiezen. Uitleg: volgt later.</div>
              </div>
                <input aria-label="Authenticiteit" type="range" min={0} max={5} value={vraak.authenticiteit} onChange={e=>setVraak({ ...vraak, authenticiteit: Number(e.target.value) })} onFocus={()=> setFocusKey('step:auth')} />
            </div>
              {focusKey==='step:auth' && (
                <GuidanceFloat entryKey="step:auth" anchorEl={document.activeElement as HTMLElement} containerEl={document.querySelector('.dialog') as HTMLElement} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
              )}
            <div>
              <div style={{fontWeight:600, marginBottom:4}}>Actualiteit</div>
                {focusKey==='step:actual' && (
                  <GuidanceFloat entryKey="step:actual" anchorEl={document.activeElement as HTMLElement} containerEl={document.querySelector('.dialog') as HTMLElement} fixedTop={112} onRequestClose={()=> setFocusKey(null)} />
                )}
                <div className="muted" style={{fontSize:12, marginBottom:6}}>Standaard: prestatie in geselecteerde lesweek (meestal juist). Pas aan wanneer het bewijs uit een eerdere periode komt.</div>
              <label style={{display:'block'}}>
                <span className="muted" style={{display:'block', fontSize:12, marginBottom:4}}>Periode van prestatie (indien ouder)</span>
                  <select value={occAge} onChange={e=> setOccAge(e.target.value as EvidenceAgeBracket|'' )} onFocus={()=> setFocusKey('step:actual')}>
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
        )}

        {mode==='wizard' && step===5 && (
          <div>
            <h4>Controle</h4>
            {/* Preview embed die dezelfde markup gebruikt als de matrix-popup */}
            <div style={{marginTop:12}}>
              <div className="muted" style={{marginBottom:6}}>
                Voorbeeld weergave (zoals in de matrix-popup)
                <br />
                <span>Dit is de tegel die je ziet als je in de matrix op het bewijsstuk klikt. Controleer of dit klopt. Zo niet, ga terug naar vorige stappen en wijzig je invoer.</span>
              </div>
              <div key={`preview-${name}|${week}|${kind}|${evlOutcomeIds.join(',')}|${(noPersp?[]:persp).join(',')}|${vraak.relevantie}|${vraak.authenticiteit}|${caseIds.join(',')}|${knowledgeIds.join(',')}`}
                style={{overflow:'hidden', width:'100%'}}
                ref={(el)=>{
                  if(!el) return
                  const artifact:any = {
                    id: 'tmp', name, week: Number(week)||0, evlOutcomeIds, caseIds, knowledgeIds,
                    vraak, kind: kind||undefined, perspectives: noPersp? [] : persp, note: note||undefined
                  }
                  ;(window as any)._pf_setPreview?.([artifact], name||'Voorbeeld')
                  // Wacht heel even zodat de matrix-preview kan renderen, clone daarna en sluit
                  setTimeout(()=>{
                    const popup = document.querySelector('.wm-preview') as HTMLElement | null
                    if(popup){
                      const clone = popup.cloneNode(true) as HTMLElement
                      clone.style.position='static'; clone.style.maxHeight='none'; clone.style.height='auto'; clone.style.overflow='visible'
                      el.innerHTML=''
                      el.appendChild(clone)
                      // Schaal indien breder dan de beschikbare ruimte
                      try{
                        const wrapperW = el.clientWidth || el.getBoundingClientRect().width
                        const rect = clone.getBoundingClientRect()
                        if(rect.width > wrapperW && wrapperW > 0){
                          const scale = Math.max(0.6, wrapperW / rect.width)
                          clone.style.transform = `scale(${scale})`
                          clone.style.transformOrigin = 'top left'
                          // Reserveer verticale ruimte zodat geen horizontale scrollbar verschijnt
                          const scaledH = rect.height * scale
                          el.style.minHeight = `${Math.ceil(scaledH)+8}px`
                        }else{
                          el.style.minHeight = `${Math.ceil(rect.height)+8}px`
                        }
                      }catch{}
                    }
                    ;(window as any)._pf_closePreview?.()
                  }, 80)
                }} />
          </div>
          </div>
        )}

        {mode==='wizard' ? (
          <div className="dialog-actions">
            <button onClick={confirmClose}>Annuleren</button>
            {step>0 && <button onClick={()=>setStep(step-1)}>Terug</button>}
            {step<(TOTAL_STEPS-1) ? (
              <div style={{display:'flex', alignItems:'center', gap:10}}>
              <button
                  title={
                    (step===0 && (startChoice==='' || (startChoice==='template' && !chosenTemplate))) ? 'Kies eerst: Sjabloon gebruiken of Vrije invoer.' :
                    (step===1 && (!name.trim() || !week || !kind || (!noPersp && persp.length===0))) ? "Vul eerst alle verplichte velden in: naam, week, soort en perspectieven (of kies 'geen perspectieven')." :
                    undefined
                  }
                  onClick={()=>{
                    if(step===0){
                      if(startChoice==='template' && chosenTemplate){ applyTemplateByName(chosenTemplate) }
                      if(startChoice==='') { return }
                    }
                    if(step===1){
                      if(!name.trim() || !week || !kind || (!noPersp && persp.length===0)){ return }
                    }
                    if(step===4){
                      // vereis dat sliders zijn ingesteld (>0)
                      if(vraak.relevantie===0 || vraak.authenticiteit===0){ return }
                    }
                    setStep(step+1)
                  }}
                  disabled={
                    (step===0 && (startChoice==='' || (startChoice==='template' && !chosenTemplate))) ||
                    (step===1 && (!name.trim() || !week || !kind || (!noPersp && persp.length===0))) ||
                    (step===4 && (vraak.relevantie===0 || vraak.authenticiteit===0))
                  }
              >Volgende</button>
              </div>
            ) : (
              <button onClick={save}>Opslaan</button>
            )}
          </div>
        ) : (
          <>
            {/* In formulier-modus tonen we óók eerst alleen de startoptie */}
            {mode==='full' && step===0 ? (
              <>
                <div>
                  <h4>Startoptie</h4>
                  <div style={{display:'grid', gap:8}}>
                    <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                      <input type="radio" checked={startChoice==='template'} onChange={()=>{ setStartChoice('template') }} /> Sjabloon gebruiken
                    </label>
                    <div className="muted" style={{fontSize:12, paddingLeft:22}}>
                      Het sjabloon vult een aantal velden alvast in. Je kunt alles later nog aanpassen. Let op: niet alle (verplichte) velden zijn vooraf ingevuld.
                    </div>
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
                        {Boolean(chosenTemplate) && (
                          <aside style={{marginTop:8, background:'linear-gradient(180deg, rgba(255,184,76,.10), transparent)', border:'1px solid rgba(255,184,76,.6)', borderRadius:8, padding:8, fontSize:12}}>
                            <div style={{fontWeight:600, marginBottom:4}}>Toelichting sjabloon</div>
                            <div>{(templates.find(x=>x.name===chosenTemplate)?.note) || 'Geen toelichting beschikbaar bij dit sjabloon.'}</div>
                          </aside>
                        )}
                      </div>
                    )}
                    <label style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                      <input type="radio" checked={startChoice==='free'} onChange={()=>{ setStartChoice('free') }} /> Vrije invoer
                    </label>
                      <div className="muted" style={{fontSize:12, paddingLeft:22}}>
                      Je bepaalt zelf alle velden: naam, soort bewijs, leeruitkomsten en VRAAK‑criteria. Kies dit als je iets wilt toevoegen dat niet in een sjabloon past.
                      </div>
                  </div>
                </div>
                <div className="dialog-actions">
                  <button className="file-label" onClick={confirmClose}>Annuleren</button>
                  <button className="btn" onClick={()=>{ if(startChoice==='template' && chosenTemplate){ applyTemplateByName(chosenTemplate) } setStep(1) }} disabled={startChoice==='' || (startChoice==='template' && !chosenTemplate)}>Volgende</button>
                </div>
              </>
            ) : (
            <>
            <div className="grid" style={{gridTemplateColumns:'1fr 220px'}}>
              <label><span>Naam (verplicht)</span>
                <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="bijv. e-learning certificaat"/>
                  <InfoTip content="Kies een specifieke, herkenbare titel. Vermijd vage namen." />
                  <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='name'?null:'name')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                </div>
              </label>
              {fullHelpKey==='name' && (
                <GuidanceInline entryKey="step:name" extraNote={startChoice==='template' ? 'Je koos voor een sjabloon: velden zoals naam of soort kunnen al ingevuld zijn. Je kunt deze altijd aanpassen.' : undefined} />
              )}
              <label><span>Week (verplicht)</span>
                <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                <select value={week} onChange={e=>setWeek(Number(e.target.value) as any)}>
                    <option value="">Kies week…</option>
                  {yearWeeks.filter(w=> visibleWeeks.includes(w.week)).map(w => {
                    const label = `${w.code||w.label}${w.startISO ? ' — '+w.startISO : ''}`
                    return <option key={w.week} value={w.week}>{label}</option>
                  })}
                </select>
                  <InfoTip content="Spreid bewijs over de tijd; week kun je later aanpassen of verslepen." />
                  <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='week'?null:'week')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                </div>
              </label>
              {fullHelpKey==='week' && (
                <GuidanceInline entryKey="step:week" />
              )}
              <label><span>Soort (verplicht)</span>
                <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
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
                  <InfoTip content="Mix van soorten maakt je portfolio sterker; elk type heeft voor- en nadelen." />
                  <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='kind'?null:'kind')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                </div>
              </label>
              {fullHelpKey==='kind' && (
                <GuidanceInline entryKey="step:kind" />
              )}
              {templates.length>0 && (
                <label><span>Sjabloon</span>
                  <select onChange={e=>{
                    const t = templates.find(x=> x.name===e.target.value)
                    if(!t) return
                    setName(t.name)
                    setEvlOutcomeIds([...(t.evl||[])])
                    setCaseIds([...(t.cases||[])])
                    setKnowledgeIds([...(t.knowledge||[])])
                    setVraak({ ...(t.vraak||{ variatie:0, relevantie:0, authenticiteit:0, actualiteit:0, kwantiteit:0 }) })
                    if(t.kind){ setKind(t.kind) }
                  }}>
                    <option value="">Kies sjabloon…</option>
                    {templates.map(t=> <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </label>
              )}
              <label style={{gridColumn:'1 / -1'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                  <span>Perspectieven (verplicht, meerdere mogelijk)</span>
                  <InfoTip content="Combineer meerdere perspectieven; docent/stagebegeleider weegt vaak zwaarder, maar elk perspectief voegt waarde toe." />
                  <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='persp'?null:'persp')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                  {(['zelfreflectie','docent','student-p','student-hf1','student-hf2-3','stagebegeleider','patient','overig'] as PerspectiveKey[]).map(p => (
                    <label key={p} style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                      <input type="checkbox" checked={persp.includes(p)} onChange={()=> setPersp(s=> s.includes(p) ? s.filter(x=>x!==p) : [...s,p]) } /> {p}
                    </label>
                  ))}
                </div>
              </label>
              {fullHelpKey==='persp' && (
                <GuidanceInline entryKey="step:persp" />
              )}
              <label style={{gridColumn:'1 / -1'}}>
                <span>Extra toelichting (optioneel)</span>
                <textarea value={note} onChange={e=> setNote(e.target.value)} placeholder="Context, aanpak, bijzonderheden…" rows={4} />
              </label>
            </div>
            <fieldset>
              <legend>EVL leeruitkomsten</legend>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <InfoTip content="Kies leeruitkomsten bij passende EVL’s; dekking over alle EVL’s is het doel." />
                <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='evl'?null:'evl')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
              </div>
              {fullHelpKey==='evl' && (
                <GuidanceInline entryKey="step:evl" />
              )}
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
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{fontWeight:600}}>Relevantie</div>
                      <InfoTip content="Hoe goed sluit dit bewijs aan op de leerdoelen van deze cursus?" />
                      <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='rel'?null:'rel')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                    </div>
                  </div>
                  <input type="range" min={0} max={5} value={vraak.relevantie} onChange={e=>setVraak({ ...vraak, relevantie: Number(e.target.value) })} />
                </div>
                {fullHelpKey==='rel' && (
                  <GuidanceInline entryKey="step:rel" />
                )}
                <div style={{display:'grid', gridTemplateColumns:'1fr 220px', alignItems:'center', gap:12}}>
                  <div>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{fontWeight:600}}>Authenticiteit</div>
                      <InfoTip content="Hoe echt/praktijkgetrouw is bewijs en context?" />
                      <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='auth'?null:'auth')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                    </div>
                  </div>
                  <input type="range" min={0} max={5} value={vraak.authenticiteit} onChange={e=>setVraak({ ...vraak, authenticiteit: Number(e.target.value) })} />
                </div>
                {fullHelpKey==='auth' && (
                  <GuidanceInline entryKey="step:auth" />
                )}
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{fontWeight:600, marginBottom:4}}>Actualiteit</div>
                    <InfoTip content="Recent bewijs is sterker dan bewijs van (lang) geleden." />
                    <button type="button" onClick={()=> setFullHelpKey(fullHelpKey==='actual'?null:'actual')} className="file-label" style={{padding:'4px 8px', fontSize:12}}>Toon uitleg</button>
                  </div>
                  {fullHelpKey==='actual' && (
                    <GuidanceInline entryKey="step:actual" />
                  )}
                  <label style={{display:'block'}}>
                    <span className="muted" style={{display:'block', fontSize:12, marginBottom:4}}>Periode van prestatie (indien ouder)</span>
                    <select value={occAge} onChange={e=> setOccAge(e.target.value as EvidenceAgeBracket|'' )}>
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
            <div className="dialog-actions" style={{flexWrap:'wrap'}}>
              <button className="file-label" onClick={confirmClose}>Annuleren</button>
              <button onClick={()=> setStep(0)}>Vorige</button>
              <button type="button" onClick={()=>{
                const artifact:any = {
                  id: 'tmp', name, week: Number(week)||0, evlOutcomeIds, caseIds, knowledgeIds,
                  vraak, kind: kind||undefined, perspectives: noPersp? [] : persp, note: note||undefined
                }
                const host = document.createElement('div')
                host.style.position='fixed'; host.style.left='8px'; host.style.right='8px'; host.style.bottom='68px'; host.style.maxHeight='60vh'; host.style.overflow='auto'; host.style.zIndex='3500'; host.style.background='transparent'
                document.body.appendChild(host)
                const cleanup = ()=>{ if(host.parentNode){ document.body.removeChild(host) }; window.removeEventListener('mousedown', onClose,true); window.removeEventListener('keydown', onKey,true) }
                ;(window as any)._pf_setPreview?.([artifact], name||'Voorbeeld')
                setTimeout(()=>{
                  const popup = document.querySelector('.wm-preview') as HTMLElement | null
                  if(popup){
                    const clone = popup.cloneNode(true) as HTMLElement
                    clone.style.position='static'; clone.style.maxHeight='none'; clone.style.height='auto'; clone.style.overflow='visible'
                    // schaal indien nodig
                    const wrap = document.createElement('div')
                    wrap.style.overflow='hidden'; wrap.style.width='100%'
                    host.innerHTML=''
                    // eigen sluitknop voor inline preview
                    // Kopregel voor preview met titel en sluiten-knop (gekoppeld aan deze inline preview)
                    const header = document.createElement('div')
                    header.style.position='sticky'; header.style.top='0'; header.style.zIndex='1'
                    header.style.background='var(--surface)'
                    header.style.display='flex'; header.style.alignItems='center'; header.style.justifyContent='space-between'; header.style.gap='8px'
                    header.style.padding='6px 0'
                    const h = document.createElement('div'); h.style.fontWeight='600'; h.textContent = `Preview — ${name||'voorbeeld'}`
                    const x = document.createElement('button'); x.className='wm-smallbtn'; x.textContent='Sluiten'; x.onclick = cleanup
                    header.appendChild(h); header.appendChild(x)
                    host.appendChild(header)
                    wrap.appendChild(clone)
                    host.appendChild(wrap)
                    // maak matrix-knoppen inert binnen de clone
                    try{
                      // Verberg/lamsla matrix-eigen knoppen in de clone
                      clone.querySelectorAll('button').forEach((b:any)=>{ b.disabled=true; b.style.pointerEvents='none'; b.style.opacity='0.6' })
                      const matrixClose = clone.querySelector('button') as HTMLButtonElement | null
                      if(matrixClose){ matrixClose.style.display='none' }
                    }catch{}
                    const adjust=()=>{
                      const w = wrap.clientWidth
                      const rect = clone.getBoundingClientRect()
                      if(rect.width>w && w>0){ const s=Math.max(0.6,w/rect.width); clone.style.transform=`scale(${s})`; clone.style.transformOrigin='top left'; host.style.minHeight=`${Math.ceil(rect.height*s)+8}px` } else { clone.style.transform=''; host.style.minHeight=`${Math.ceil(rect.height)+8}px` }
                    }
                    adjust(); setTimeout(adjust,10)
                  }
                  ;(window as any)._pf_closePreview?.()
                }, 60)
                // sluit bij tweede klik buiten
                const onClose=(e:MouseEvent)=>{ if(!host.contains(e.target as Node)){ cleanup() } }
                window.addEventListener('mousedown', onClose, true)
                const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape') cleanup() }
                window.addEventListener('keydown', onKey, true)
              }}>Preview</button>
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


