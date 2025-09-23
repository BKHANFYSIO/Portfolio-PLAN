import { useEffect, useMemo, useState } from 'react'
import { LS_KEYS, readJson } from '../lib/storage'
import type { PortfolioPlan } from '../lib/storage'

type Props = { onClose: ()=>void }

export default function BackupDialog({ onClose }: Props){
  const plans = readJson<PortfolioPlan[]>(LS_KEYS.plans, [])
  const [selected, setSelected] = useState<string[]>(plans.map(p=>p.id))

  function toggle(id: string){
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id])
  }

  function download(){
    // Neem ook curriculum en years op voor volledige context
    const curriculum = readJson(LS_KEYS.curriculum, null as any)
    const years = readJson(LS_KEYS.years, null as any)
    const payload = { plans: plans.filter(p=>selected.includes(p.id)), curriculum, years }
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'portfolio-plannen.json'; a.click(); URL.revokeObjectURL(a.href)
    onClose()
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={e=>e.stopPropagation()}>
        <h3>Backup maken</h3>
        <p className="muted">Kies welke plannen je wilt opnemen in de backup.</p>
        <ul style={{maxHeight:260, overflow:'auto'}}>
          {plans.map(p=> (
            <li key={p.id} className="row" style={{borderTop:'none', padding:'6px 0'}}>
              <label style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} />
                <span>{p.name}</span>
                <span className="muted" style={{fontSize:12}}>{p.year} · {p.courseName}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button onClick={onClose}>Annuleren</button>
          <button onClick={download}>Download</button>
        </div>
      </div>
    </div>
  )
}


