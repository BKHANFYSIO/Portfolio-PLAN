import { useEffect, useRef, useState } from 'react'
import { GUIDANCE, VRAAK_META } from '../lib/guidance'

type Props = { entryKey: string; anchorEl: HTMLElement | null; extraNote?: string; onRequestClose?: ()=>void; containerEl?: HTMLElement | null; forcePlacement?: 'bottom'|'right'|'left'|'top'; fixedTop?: number }

export default function GuidanceFloat({ entryKey, anchorEl, extraNote, onRequestClose, containerEl, forcePlacement, fixedTop }: Props){
  const g = GUIDANCE[entryKey]
  const [pos, setPos] = useState<{ mode:'desktop'|'mobile'; top?:number; left?:number; placement?: 'bottom'|'right'|'left'|'top' }>(()=>({mode: window.innerWidth<=700?'mobile':'desktop'}))
  const floatRef = useRef<HTMLDivElement|null>(null)

  const recalc = ()=>{
    const isMobile = window.innerWidth<=700
    if(isMobile){ setPos({mode:'mobile'}); return }
    if(!anchorEl){ return }
    const r = anchorEl.getBoundingClientRect()
    const containerRect = containerEl?.getBoundingClientRect()
    const minSideW = 360
    const spaceRight = window.innerWidth - r.right - 8
    const spaceLeft = r.left - 8
    const isComboboxLike = anchorEl.tagName==='SELECT' || anchorEl.getAttribute('role')==='combobox' || anchorEl.getAttribute('aria-haspopup')==='listbox'

    // prefer forced placement when set
    const sideWidth = Math.min(420, Math.floor(window.innerWidth * 0.46))
    const bottomWidth = Math.min(560, Math.floor(window.innerWidth * 0.92))
    const clampToContainer = (left:number, width:number)=>{
      if(!containerRect){
        return Math.max(8, Math.min(left, window.innerWidth - width - 8))
      }
      const minLeft = containerRect.left + 8
      const maxLeft = Math.min(window.innerWidth - 8, containerRect.right - 8 - width)
      return Math.max(minLeft, Math.min(left, maxLeft))
    }

    if(forcePlacement==='left'){
      const top = typeof fixedTop==='number' ? fixedTop : Math.max(8, r.top)
      setPos({mode:'desktop', left: clampToContainer(r.left - sideWidth - 8, sideWidth), top, placement:'left'})
      return
    }
    if(forcePlacement==='right'){
      const top = typeof fixedTop==='number' ? fixedTop : Math.max(8, r.top)
      setPos({mode:'desktop', left: clampToContainer(r.right + 8, sideWidth), top, placement:'right'})
      return
    }
    if(forcePlacement==='top'){
      // Voorlopig top = r.top; na renderen corrigeren we met eigen hoogte
      const top = typeof fixedTop==='number' ? fixedTop : r.top
      setPos({mode:'desktop', left: clampToContainer(Math.max(8, Math.min(r.left, window.innerWidth - bottomWidth - 8)), bottomWidth), top, placement:'top'})
      return
    }

    if(isComboboxLike && spaceRight >= minSideW){
      setPos({mode:'desktop', left: clampToContainer(r.right + 8, sideWidth), top: Math.max(8, r.top), placement:'right'})
      return
    }
    if(isComboboxLike && spaceLeft >= minSideW){
      setPos({mode:'desktop', left: clampToContainer(r.left - sideWidth - 8, sideWidth), top: Math.max(8, r.top), placement:'left'})
      return
    }
    const left = clampToContainer(Math.max(8, Math.min(r.left, window.innerWidth - bottomWidth - 8)), bottomWidth)
    const top = typeof fixedTop==='number' ? fixedTop : Math.max(8, r.bottom + 8)
    setPos({mode:'desktop', left, top, placement:'bottom'})
  }

  // Corrigeer top-plaatsing met gemeten hoogte van de popover
  useEffect(()=>{
    if(pos.mode!=='desktop' || pos.placement!=='top' || !anchorEl || !floatRef.current || typeof fixedTop==='number') return
    const r = anchorEl.getBoundingClientRect()
    const h = floatRef.current.getBoundingClientRect().height
    const top = Math.max(8, r.top - h - 8)
    if(pos.top !== top){ setPos(p=> ({...p, top})) }
  }, [pos.mode, pos.placement, anchorEl, floatRef.current, fixedTop])

  useEffect(()=>{ recalc() }, [anchorEl])
  useEffect(()=>{
    const on = ()=> recalc()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return ()=>{ window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true) }
  }, [])

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape'){ onRequestClose?.() } }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [onRequestClose])

  if(!g) return null

  const base = {
    background:'var(--surface)',
    border:'1px solid rgba(255,184,76,.60)',
    borderRadius:12,
    padding:10,
    boxShadow:'0 12px 32px rgba(0,0,0,.35)',
    zIndex:2000 as any,
    width: pos.placement==='right' || pos.placement==='left' ? 'min(420px, 46vw)' : 'min(560px, 92vw)'
  } as const

  return (
    <div ref={floatRef} style={pos.mode==='mobile'
      ? { position:'fixed', left:8, right:8, bottom:8, maxHeight:'50vh', overflow:'auto', ...base }
      : { position:'fixed', top:pos.top, left:pos.left, maxHeight: '60vh', overflow:'auto', ...base }}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <div style={{fontWeight:600}}>Uitleg</div>
        {g.criteriaKeys && g.criteriaKeys.length>0 && (
          <div style={{display:'inline-flex', gap:6}}>
            {g.criteriaKeys.map(k => (
              <span key={k} className="wm-chip" title={`Van invloed op ${VRAAK_META[k].label} uit de VRAAK-criteria — ${VRAAK_META[k].description}`}>{k.toUpperCase()}</span>
            ))}
          </div>
        )}
        <div style={{marginLeft:'auto'}}>
          <button className="wm-smallbtn" onClick={onRequestClose}>Sluiten</button>
        </div>
      </div>
      <div style={{fontSize:12}}>{g.longHelp}</div>
      {extraNote && <div className="muted" style={{fontSize:12, marginTop:4}}>{extraNote}</div>}
      {g.examples && g.examples.length>0 && (
        <div style={{marginTop:6}}>
          <div className="muted" style={{fontSize:12, marginBottom:4}}>Voorbeelden</div>
          <ul style={{margin:0, paddingLeft:16}}>
            {g.examples.map((ex,idx)=> <li key={idx} style={{fontSize:12}}>{ex}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}


