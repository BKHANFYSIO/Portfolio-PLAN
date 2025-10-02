import { GUIDANCE, VRAAK_META } from '../lib/guidance'

type Props = { entryKey: string; extraNote?: string }

export default function GuidanceInline({ entryKey, extraNote }: Props){
  const g = GUIDANCE[entryKey]
  if(!g) return null
  return (
    <div style={{gridColumn:'1 / -1', marginTop:6}}>
      <aside style={{
        background:'linear-gradient(180deg, rgba(255,184,76,.08), transparent)',
        border:'1px dashed rgba(255,184,76,.6)',
        borderRadius:8, padding:10, display:'grid', gap:6
      }}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{fontWeight:600}}>Uitleg</div>
          {g.criteriaKeys && g.criteriaKeys.length>0 && (
            <div style={{display:'inline-flex', gap:6}}>
              {g.criteriaKeys.map(k => (
                <span key={k} className="wm-chip" title={`Van invloed op ${VRAAK_META[k].label} uit de VRAAK-criteria — ${VRAAK_META[k].description}`}>{k.toUpperCase()}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{fontSize:12}}>{g.longHelp}</div>
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
    </div>
  )
}


