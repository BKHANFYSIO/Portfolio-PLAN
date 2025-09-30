import { useEffect, useRef } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm'|'md'|'lg'|'xl'
  closeOnBackdrop?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, size='md', closeOnBackdrop=true, footer, children }: ModalProps){
  const ref = useRef<HTMLDivElement|null>(null)
  const lastActive = useRef<HTMLElement|null>(null)

  useEffect(()=>{
    if(!open) return
    lastActive.current = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent)=>{ if(e.key==='Escape'){ e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey)
    // focus first focusable inside
    setTimeout(()=>{
      const root = ref.current
      if(!root) return
      const el = root.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      el?.focus()
    }, 0)
    return ()=>{
      document.removeEventListener('keydown', onKey)
      lastActive.current?.focus?.()
    }
  }, [open, onClose])

  if(!open) return null

  const width = size==='sm'? 'min(360px, 92vw)' : size==='md'? 'min(520px, 92vw)' : size==='lg'? 'min(760px, 92vw)' : 'min(960px, 92vw)'

  return (
    <div className="modal-backdrop" role="presentation" onClick={()=>{ if(closeOnBackdrop) onClose() }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title? 'modal-title' : undefined}
        onClick={e=> e.stopPropagation()}
        ref={ref}
        style={{ width }}
      >
        <div className="modal-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <h3 id="modal-title" style={{margin:0}}>{title}</h3>
          <button className="icon-btn" aria-label="Sluiten" onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {(footer!==undefined) && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}


