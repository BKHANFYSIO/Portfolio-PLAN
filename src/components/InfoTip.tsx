import { useEffect, useRef, useState } from 'react'

type Props = { title?: string; content: string | JSX.Element }

export default function InfoTip({ title, content }: Props){
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement|null>(null)
  const tipRef = useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    if(!open) return
    const onKey = (e: KeyboardEvent)=>{ if(e.key==='Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <span style={{position:'relative', display:'inline-block'}}>
      <button
        ref={btnRef}
        type="button"
        aria-label={title||'Uitleg'}
        className="wm-smallbtn"
        style={{padding:'2px 6px', fontSize:11}}
        onMouseEnter={()=> setOpen(true)}
        onFocus={()=> setOpen(true)}
        onMouseLeave={(e)=>{
          // sluit alleen als we niet over de tooltip bewegen
          const related = e.relatedTarget as Node | null
          if(tipRef.current && tipRef.current.contains(related)) return
          setOpen(false)
        }}
        onBlur={()=> setOpen(false)}
      >i</button>
      {open && (()=>{
        const r = btnRef.current?.getBoundingClientRect()
        const left = r?.left || 0
        const top = (r?.bottom || 0) + 6
        const maxW = Math.min(360, window.innerWidth - left - 16)
        return (
          <div
            ref={tipRef}
            role="tooltip"
            onMouseLeave={()=> setOpen(false)}
            style={{
              position:'fixed', zIndex:4000, left, top,
              minWidth:240, maxWidth: maxW,
              background:'var(--surface)', border:'1px solid var(--line-strong)', borderRadius:8, padding:8,
              boxShadow:'0 8px 18px rgba(0,0,0,.35)',
              whiteSpace:'normal', overflowWrap:'anywhere', wordBreak:'normal', lineHeight:1.4
            }}>
            {content}
          </div>
        )
      })()}
    </span>
  )
}


