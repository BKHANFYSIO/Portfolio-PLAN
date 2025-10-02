import { GUIDANCE, VRAAK_META } from '../lib/guidance'

type Props = { entryKey: string; extraNote?: string }

export default function GuidancePanel({ entryKey, extraNote }: Props){
  const g = GUIDANCE[entryKey]
  if(!g) return null
  return (
    <aside style={{
      background:'linear-gradient(180deg, rgba(255,184,76,.10), transparent)',
      border:'1px solid rgba(255,184,76,.6)',
      borderRadius:8, padding:10, display:'grid', gap:6
    }}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <div style={{fontWeight:600}}>Uitleg</div>
        {g.criteriaKeys && g.criteriaKeys.length>0 && (
          <div style={{display:'inline-flex', gap:6}}>
            {g.criteriaKeys.map(k => (
              <span
                key={k}
                className="wm-chip"
                title={`Van invloed op ${VRAAK_META[k].label} uit de VRAAK-criteria — ${VRAAK_META[k].description}`}
              >{k.toUpperCase()}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{fontSize:12}}>{g.longHelp}</div>
      {g.criteriaKeys && g.criteriaKeys.length>0 && (
        <div className="muted" style={{fontSize:12}}>Invloed op VRAAK-criteria: {g.criteriaKeys.map(k=> VRAAK_META[k].label).join(', ')}</div>
      )}
      {extraNote && <div className="muted" style={{fontSize:12}}>{extraNote}</div>}
      {g.examples && g.examples.length>0 && (
        <div>
          <div className="muted" style={{fontSize:12, marginBottom:4}}>Voorbeelden</div>
          <ul style={{margin:0, paddingLeft:16}}>
            {g.examples.map((ex,idx)=> <li key={idx} style={{fontSize:12}}>{ex}</li>)}
          </ul>
        </div>
      )}
    </aside>
  )
}


