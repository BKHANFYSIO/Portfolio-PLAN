import { useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { LS_KEYS, readJson } from '../lib/storage'
import { getCurriculumForYear, getYears } from '../lib/curriculum'
import './planDetail.css'

export default function PrintPlan(){
  const { id } = useParams()
  const plans = readJson<any[]>(LS_KEYS.plans, [])
  const plan = plans.find(p=>p.id===id)
  const { evl, courses } = getCurriculumForYear(plan.year)
  const course = courses.find(c=>c.id===plan.courseId)
  const years = getYears()

  // Alle weeks van het studiejaar
  const weeks = useMemo(()=>{
    const y = years.find(y=>y.year===plan.year)
    return (y?.weeks||[]).map(w=>w.week)
  }, [years, plan.year])

  // Direct printen na render (kleine delay voor layout)
  const did = useRef(false)
  useEffect(()=>{ if(!did.current){ did.current=true; setTimeout(()=> window.print(), 300) } }, [])

  // Eenvoudige print layout: blokken onder elkaar, geen sticky/scroll
  return (
    <div style={{padding:'10mm', background:'var(--surface)'}}>
      <h2 style={{marginTop:0}}>{plan.name} · {plan.year} · {plan.courseName} · {plan.period.label}</h2>
      {/* EVL blokken */}
      {evl.map(block => (
        <section key={block.id} className="print-block" style={{breakInside:'avoid', pageBreakInside:'avoid', border:'1px solid var(--line-strong)', borderRadius:8, padding:8, marginBottom:12}}>
          <h3 style={{margin:'4px 0'}}>{block.id} · {block.name}</h3>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'4px 6px'}}>Leeruitkomst</th>
                {weeks.map(w=> (<th key={w} style={{padding:'4px 2px', textAlign:'center'}}>W{w}</th>))}
              </tr>
            </thead>
            <tbody>
              {block.outcomes.map(o => (
                <tr key={o.id}>
                  <td style={{padding:'2px 6px', whiteSpace:'nowrap'}}>{o.id} <span className="muted">{o.name}</span></td>
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter((a:any)=> a.week===w && (a.evlOutcomeIds||[]).includes(o.id))
                    return <td key={w} style={{padding:'2px', textAlign:'center', borderLeft:'1px solid var(--line)'}}>{list.length>0 ? list.length : ''}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {/* Casus blok */}
      {(course?.cases?.length||0)>0 && (
        <section className="print-block" style={{breakInside:'avoid', pageBreakInside:'avoid', border:'1px solid var(--line-strong)', borderRadius:8, padding:8, marginBottom:12}}>
          <h3 style={{margin:'4px 0'}}>Casussen / Thema’s</h3>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'4px 6px'}}>Casus</th>
                {weeks.map(w=> (<th key={w} style={{padding:'4px 2px', textAlign:'center'}}>W{w}</th>))}
              </tr>
            </thead>
            <tbody>
              {course!.cases.map(c => (
                <tr key={c.id}>
                  <td style={{padding:'2px 6px', whiteSpace:'nowrap'}}>{c.name}</td>
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter((a:any)=> a.week===w && (a.caseIds||[]).includes(c.id))
                    return <td key={w} style={{padding:'2px', textAlign:'center', borderLeft:'1px solid var(--line)'}}>{list.length>0 ? list.length : ''}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Kennis blok */}
      {(course?.knowledgeDomains?.length||0)>0 && (
        <section className="print-block" style={{breakInside:'avoid', pageBreakInside:'avoid', border:'1px solid var(--line-strong)', borderRadius:8, padding:8, marginBottom:12}}>
          <h3 style={{margin:'4px 0'}}>Kennis</h3>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'4px 6px'}}>Domein</th>
                {weeks.map(w=> (<th key={w} style={{padding:'4px 2px', textAlign:'center'}}>W{w}</th>))}
              </tr>
            </thead>
            <tbody>
              {course!.knowledgeDomains.map(k => (
                <tr key={k.id}>
                  <td style={{padding:'2px 6px', whiteSpace:'nowrap'}}>{k.name}</td>
                  {weeks.map(w => {
                    const list = (plan.artifacts||[]).filter((a:any)=> a.week===w && (a.knowledgeIds||[]).includes(k.id))
                    return <td key={w} style={{padding:'2px', textAlign:'center', borderLeft:'1px solid var(--line)'}}>{list.length>0 ? list.length : ''}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}


