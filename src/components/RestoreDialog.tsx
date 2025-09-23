import { useState } from 'react'
import { LS_KEYS, readJson, writeJson } from '../lib/storage'
import type { PortfolioPlan } from '../lib/storage'

type Props = { onClose: ()=>void; onRestored?: ()=>void }

export default function RestoreDialog({ onClose, onRestored }: Props){
  const [plansInFile, setPlansInFile] = useState<PortfolioPlan[]|null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [mode, setMode] = useState<'merge'|'overwrite'>('merge')
  const [rawJson, setRawJson] = useState<any>(null)

  function onFile(ev: React.ChangeEvent<HTMLInputElement>){
    const file = ev.target.files?.[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try{
        const json = JSON.parse(String(reader.result||'{}'))
        const list = (json.plans ?? []) as PortfolioPlan[]
        setPlansInFile(list)
        setSelected(list.map(p=>p.id))
        setRawJson(json)
      }catch{ alert('Geen geldige backup'); }
    }
    reader.readAsText(file)
  }

  function restore(){
    if(!plansInFile) return
    const existing = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
    if(mode==='overwrite'){
      const kept = existing.filter(p=> !selected.includes(p.id))
      const toAdd = plansInFile.filter(p=> selected.includes(p.id))
      writeJson(LS_KEYS.plans, [...toAdd, ...kept])
    }else{
      // merge: voeg toe, overschrijf alleen dezelfde id's die geselecteerd zijn
      const map = new Map(existing.map(p=> [p.id, p]))
      for(const p of plansInFile){
        if(selected.includes(p.id)) map.set(p.id, p)
      }
      writeJson(LS_KEYS.plans, Array.from(map.values()))
    }
    // Curriculum/years uit backup respecteren indien aanwezig
    if(rawJson?.curriculum) writeJson(LS_KEYS.curriculum, rawJson.curriculum)
    if(rawJson?.years) writeJson(LS_KEYS.years, rawJson.years)
    onRestored && onRestored()
    onClose()
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={e=>e.stopPropagation()}>
        <h3>Backup terugzetten</h3>
        {!plansInFile ? (
          <div className="dialog-actions" style={{justifyContent:'flex-start'}}>
            <input type="file" accept="application/json" onChange={onFile} />
          </div>
        ) : (
          <>
            <div className="muted">Selecteer welke plannen je wilt terugzetten.</div>
            <div style={{margin:'8px 0'}}>
              <label style={{marginRight:12}}><input type="radio" checked={mode==='merge'} onChange={()=>setMode('merge')} /> Samenvoegen (bestaande behouden)</label>
              <label><input type="radio" checked={mode==='overwrite'} onChange={()=>setMode('overwrite')} /> Overschrijven (geselecteerde vervangen)</label>
            </div>
            <ul style={{maxHeight:260, overflow:'auto'}}>
              {plansInFile.map(p=> (
                <li key={p.id} className="row" style={{borderTop:'none', padding:'6px 0'}}>
                  <label style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={()=> setSelected(s=> s.includes(p.id)? s.filter(x=>x!==p.id) : [...s,p.id]) } />
                    <span>{p.name}</span>
                    <span className="muted" style={{fontSize:12}}>{p.year} · {p.courseName}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="dialog-actions">
              <button onClick={onClose}>Annuleren</button>
              <button onClick={restore}>Terugzetten</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


