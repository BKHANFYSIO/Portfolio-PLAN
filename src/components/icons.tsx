
export type KindKey = 'certificaat'|'schriftelijk'|'kennistoets'|'vaardigheid'|'performance'|'gesprek'|'document'|'toets'|'overig'|string|undefined
export type PerspectiveKey = 'zelfreflectie'|'peer'|'ouderejaars'|'docent'|'extern'

export function KindIcon({ kind, className }: { kind: KindKey; className?: string }){
  const stroke = 'currentColor'
  const cls = className || 'icon'
  switch(kind){
    case 'certificaat':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M6 2h9l3 3v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path stroke={stroke} fill="none" strokeWidth="2" d="M8 7h8M8 11h8M8 15h6"/></svg>
    case 'schriftelijk':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M4 4h16v16H4z"/><path stroke={stroke} fill="none" strokeWidth="2" d="M7 8h10M7 12h10M7 16h7"/></svg>
    case 'kennistoets':
    case 'toets':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke={stroke} fill="none" strokeWidth="2"/><path stroke={stroke} fill="none" strokeWidth="2" d="M8 12h8M12 8v8"/></svg>
    case 'vaardigheid':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M8 21v-6l8-8 3 3-8 8H8z"/><circle cx="7" cy="7" r="2" stroke={stroke} fill="none" strokeWidth="2"/></svg>
    case 'performance':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M3 20h18M6 20V8l6-3 6 3v12"/></svg>
    case 'gesprek':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M3 6h14v9H7l-4 4V6z"/><path stroke={stroke} fill="none" strokeWidth="2" d="M17 10h4v8l-3-3h-1z"/></svg>
    case 'document':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M6 2h9l3 3v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg>
    default:
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke={stroke} fill="none" strokeWidth="2"/></svg>
  }
}

export function PerspectiveIcon({ p, className }: { p: PerspectiveKey; className?: string }){
  const stroke = 'currentColor'
  const cls = className || 'icon'
  switch(p){
    case 'zelfreflectie':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" stroke={stroke} fill="none" strokeWidth="2"/><path stroke={stroke} fill="none" strokeWidth="2" d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z"/></svg>
    case 'peer':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3" stroke={stroke} fill="none" strokeWidth="2"/><circle cx="16" cy="8" r="3" stroke={stroke} fill="none" strokeWidth="2"/><path stroke={stroke} fill="none" strokeWidth="2" d="M4 18v-1c0-2.2 2.7-4 6-4m4 0c3.3 0 6 1.8 6 4v1"/></svg>
    case 'ouderejaars':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4"/></svg>
    case 'docent':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path stroke={stroke} fill="none" strokeWidth="2" d="M4 5h12v10H4z"/><path stroke={stroke} fill="none" strokeWidth="2" d="M6 7h8M6 10h8M20 6v12l-4-3-4 3V6"/></svg>
    case 'extern':
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke={stroke} fill="none" strokeWidth="2"/><path stroke={stroke} fill="none" strokeWidth="2" d="M12 3v6l4 2"/></svg>
    default:
      return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke={stroke} fill="none" strokeWidth="2"/></svg>
  }
}


