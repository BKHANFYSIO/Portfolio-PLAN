import { useEffect, useMemo, useRef, useState } from 'react'
import type { PortfolioPlan } from '../lib/storage'
import { getCurriculum, getYears } from '../lib/curriculum'
import './weekMatrix.css'

type Props = { plan: PortfolioPlan }

export default function WeekMatrix({ plan }: Props){
  const { evl, courses } = getCurriculum()
  const years = getYears()
  const course = courses.find(c=>c.id===plan.courseId)
  const evlExcluded = course?.evlOverrides?.EVL1 || []
  const evlForCourse = useMemo(()=> evl.map(b => b.id==='EVL1' ? ({...b, outcomes: b.outcomes.filter(o=>!evlExcluded.includes(o.id))}) : b), [evl, course])
  const weeks = useMemo(()=>{
    const year = years.find(y=>y.year===plan.year)
    const all = (year?.weeks || []).map(w=>w.week)
    if(plan.period?.type==='periode'){
      const p = Number(plan.period.value)
      if(p>=1 && p<=4){
        const chunk = Math.ceil(all.length/4)
        const start = (p-1)*chunk
        return all.slice(start, start+chunk)
      }
    }
    if(plan.period?.type==='semester'){
      const s = Number(plan.period.value)
      if(s===1){ return all.slice(0, Math.ceil(all.length/2)) }
      if(s===2){ return all.slice(Math.ceil(all.length/2)) }
    }
    if(plan.period?.type==='maatwerk' && Array.isArray(plan.period.value)){
      const [start,end] = plan.period.value
      return all.filter(w=> w>=start && w<=end)
    }
    return all
  }, [plan.year, years, plan.period])

  // const rows = useMemo(()=> evlForCourse.flatMap(b => b.outcomes.map(o => ({ evlId: b.id, lukId: o.id, name: o.name }))), [evlForCourse])
  const [openCasus, setOpenCasus] = useState<boolean>(true)
  const [openKennis, setOpenKennis] = useState<boolean>(false)

  const [open, setOpen] = useState<Record<string, boolean>>(()=>Object.fromEntries(evlForCourse.map(b=>[b.id,true])))
  function toggleBlock(id: string){ setOpen(s=> ({...s, [id]: !s[id]})) }

  function artifactsIn(lukId: string, week: number){
    return (plan.artifacts||[]).filter(a => a.week===week && a.evlOutcomeIds.includes(lukId))
  }

  function averageVraak(scores: {variatie:number;relevantie:number;authenticiteit:number;actualiteit:number;kwantiteit:number}[]){
    if(scores.length===0) return '—'
    const sum = scores.reduce((a,s)=>({
      variatie:a.variatie+s.variatie,
      relevantie:a.relevantie+s.relevantie,
      authenticiteit:a.authenticiteit+s.authenticiteit,
      actualiteit:a.actualiteit+s.actualiteit,
      kwantiteit:a.kwantiteit+s.kwantiteit
    }), {variatie:0,relevantie:0,authenticiteit:0,actualiteit:0,kwantiteit:0})
    const avg = (sum.variatie+sum.relevantie+sum.authenticiteit+sum.actualiteit+sum.kwantiteit)/(scores.length*5)
    return avg.toFixed(2)
  }

  const wrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const hScrollRef = useRef<HTMLDivElement>(null)
  const [spacerW, setSpacerW] = useState<number>(0)
  const dragRef = useRef<{down:boolean; dragging:boolean; lastX:number}>({down:false,dragging:false,lastX:0})
  const [dragging, setDragging] = useState(false)

  useEffect(()=>{
    const resize = () => {
      const w = tableRef.current?.scrollWidth || 0
      const visible = wrapRef.current?.clientWidth || 0
      // Spacer minimaal zichtbare breedte zodat balk altijd zichtbaar is
      setSpacerW(Math.max(w, visible))
      if(hScrollRef.current && wrapRef.current){
        hScrollRef.current.scrollLeft = wrapRef.current.scrollLeft
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [weeks.length])

  useEffect(()=>{
    let syncing = false
    const w = wrapRef.current
    const h = hScrollRef.current
    if(!w || !h) return
    const onWrap = () => {
      if(syncing) return; syncing = true; h.scrollLeft = w.scrollLeft; syncing = false
    }
    const onH = () => {
      if(syncing) return; syncing = true; w.scrollLeft = h.scrollLeft; syncing = false
    }
    w.addEventListener('scroll', onWrap, { passive: true })
    h.addEventListener('scroll', onH, { passive: true })
    return () => { w.removeEventListener('scroll', onWrap); h.removeEventListener('scroll', onH) }
  }, [spacerW])

  return (
    <div className={`wm-wrap${dragging ? ' dragging' : ''}`} ref={wrapRef}
      onPointerDown={(e)=>{
        dragRef.current.down = true
        dragRef.current.dragging = false
        dragRef.current.lastX = e.clientX
      }}
      onPointerMove={(e)=>{
        if(!dragRef.current.down || !wrapRef.current) return
        const dx = e.clientX - dragRef.current.lastX
        if(!dragRef.current.dragging && Math.abs(dx) > 3){
          dragRef.current.dragging = true
          setDragging(true)
        }
        if(dragRef.current.dragging){
          wrapRef.current.scrollLeft -= dx
          dragRef.current.lastX = e.clientX
        }
      }}
      onPointerUp={()=>{
        dragRef.current.down = false
        if(dragRef.current.dragging){
          dragRef.current.dragging = false
          setDragging(false)
        }
      }}
      onPointerCancel={()=>{ dragRef.current.down=false; if(dragRef.current.dragging){ dragRef.current.dragging=false; setDragging(false) } }}
      onPointerLeave={()=>{ dragRef.current.down=false; if(dragRef.current.dragging){ dragRef.current.dragging=false; setDragging(false) } }}
    >
      <div ref={tableRef} className="wm-table" style={{ ['--weeks' as any]: weeks.length, ['--colWidth' as any]: '96px', ['--leftWidth' as any]: '320px', ['--rightWidth' as any]: '140px' }}>
        <div className="wm-header">
          <div className="wm-corner">
            <div className="wm-corner-inner">
              <span>LUK / Week</span>
              {(()=>{
                const anyOpen = Object.values(open).some(v=>v) || openCasus || openKennis
                const toggleAll = () => {
                  const next = !anyOpen
                  setOpen(Object.fromEntries(evlForCourse.map(b=>[b.id, next])))
                  setOpenCasus(next)
                  setOpenKennis(next)
                }
                return <button className="wm-smallbtn" onClick={toggleAll}>{anyOpen ? 'Alles inklappen' : 'Alles uitklappen'}</button>
              })()}
            </div>
          </div>
          <div className="wm-cols">
            {weeks.map(w=> {
              const y = years.find(y=>y.year===plan.year)
              const info = y?.weeks.find(ww=> ww.week===w)
              const label = info?.isHoliday ? `W${w}*` : `W${w}`
              const title = info ? `${info.label} · ${info.startISO} — ${info.endISO}${info.isHoliday ? ' · Vakantie' : ''}` : `W${w}`
              return <div key={w} className={`wm-col ${info?.isHoliday ? 'holiday':''}`} title={title}>{label}</div>
            })}
          </div>
          <div className="wm-vcol sticky-right">VRAAK</div>
        </div>
        <div className="wm-body">
          {evlForCourse.map(block => (
            <div key={block.id}>
              <div className="wm-evlhead" onClick={()=>toggleBlock(block.id)}>
                <div className="wm-rowhead evl">
                  <span className={open[block.id] ? 'caret down' : 'caret'} /> {block.id} · {block.name}
                </div>
                <div className="wm-cells">
                  {weeks.map(w => {
                    const outcomeIds = block.outcomes.map(o=>o.id)
                    const list = (plan.artifacts||[]).filter(a=> a.week===w && a.evlOutcomeIds.some(id=> outcomeIds.includes(id)))
                    return <div key={`evlh-${block.id}-${w}`} className="wm-cell">{list.length>0 && <div className="wm-chip">{list.length}</div>}</div>
                  })}
                </div>
                <div className="wm-vraak sticky-right">
                  {
                    (()=>{
                      const outcomeIds = block.outcomes.map(o=>o.id)
                      const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.evlOutcomeIds.some(id=> outcomeIds.includes(id)))
                      return averageVraak(arts.map(a=>a.vraak))
                    })()
                  }
                </div>
              </div>

              {open[block.id] && block.outcomes.map(o => (
                <div key={o.id} className="wm-row">
                  <div className="wm-rowhead">{o.id} <span className="muted">{o.name}</span></div>
                  <div className="wm-cells">
                    {weeks.map(w => {
                      const list = artifactsIn(o.id, w)
                      return (
                        <div key={w} className="wm-cell">
                          {list.length>0 ? (
                            <div className="wm-chip">{list.length}</div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <div className="wm-vraak sticky-right">
                    {
                      (()=>{
                        const arts = (plan.artifacts||[]).filter(a => weeks.includes(a.week) && a.evlOutcomeIds.includes(o.id))
                        return averageVraak(arts.map(a=>a.vraak))
                      })()
                    }
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Casussen sectie */}
          <div>
            <div className="wm-evlhead" onClick={()=>setOpenCasus(v=>!v)}>
              <div className="wm-rowhead evl"><span className={openCasus ? 'caret down':'caret'} /> Casussen</div>
              <div className="wm-cells">
                {weeks.map(w => {
                  const list = (plan.artifacts||[]).filter(a=> a.week===w && a.caseIds.length>0)
                  return <div key={`cash-${w}`} className="wm-cell">{list.length>0 && <div className="wm-chip">{list.length}</div>}</div>
                })}
              </div>
              <div className="wm-vraak sticky-right">
                {
                  (()=>{
                    const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.caseIds.length>0)
                    return averageVraak(arts.map(a=>a.vraak))
                  })()
                }
              </div>
            </div>
            {openCasus && course?.cases.map(c => (
              <div key={c.id} className="wm-row">
                <div className="wm-rowhead">{c.name}</div>
                <div className="wm-cells">
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter(a=> a.week===w && a.caseIds.includes(c.id))
                    return <div key={w} className="wm-cell">{list.length>0 && <div className="wm-chip">{list.length}</div>}</div>
                  })}
                </div>
                <div className="wm-vraak sticky-right">
                  {
                    (()=>{
                      const arts = (plan.artifacts||[]).filter(a => weeks.includes(a.week) && a.caseIds.includes(c.id))
                      return averageVraak(arts.map(a=>a.vraak))
                    })()
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Kennis sectie */}
          <div>
            <div className="wm-evlhead" onClick={()=>setOpenKennis(v=>!v)}>
              <div className="wm-rowhead evl"><span className={openKennis ? 'caret down':'caret'} /> Kennis</div>
              <div className="wm-cells">
                {weeks.map(w => {
                  const list = (plan.artifacts||[]).filter(a=> a.week===w && a.knowledgeIds.length>0)
                  return <div key={`kenh-${w}`} className="wm-cell">{list.length>0 && <div className="wm-chip">{list.length}</div>}</div>
                })}
              </div>
              <div className="wm-vraak sticky-right">
                {
                  (()=>{
                    const arts = (plan.artifacts||[]).filter(a=> weeks.includes(a.week) && a.knowledgeIds.length>0)
                    return averageVraak(arts.map(a=>a.vraak))
                  })()
                }
              </div>
            </div>
            {openKennis && course?.knowledgeDomains.map(k => (
              <div key={k.id} className="wm-row">
                <div className="wm-rowhead">{k.name}</div>
                <div className="wm-cells">
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter(a=> a.week===w && a.knowledgeIds.includes(k.id))
                    return <div key={w} className="wm-cell">{list.length>0 && <div className="wm-chip">{list.length}</div>}</div>
                  })}
                </div>
                <div className="wm-vraak sticky-right">
                  {
                    (()=>{
                      const arts = (plan.artifacts||[]).filter(a => weeks.includes(a.week) && a.knowledgeIds.includes(k.id))
                      return averageVraak(arts.map(a=>a.vraak))
                    })()
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="wm-mask-left" />
      <div className="wm-hscroll sticky-bottom" ref={hScrollRef}>
        <div className="wm-hspacer" style={{ width: spacerW }} />
      </div>
    </div>
  )
}


