import { useMemo } from 'react'
import { getCurriculum } from '../lib/curriculum'
import * as XLSX from 'xlsx'

export default function Admin(){
  const { courses, evl } = getCurriculum()

  function generateTemplate(courseId: string){
    const course = courses.find(c=>c.id===courseId)
    if(!course) return
    // Bepaal alle EVL codes die relevant zijn (alle LUK IDs uit EVL 1..5)
    const allCodes = evl.flatMap(b => b.outcomes.map(o=>o.id))

    // Kolommen voor sjablonen
    const headers = ['Naam','EVL','Casussen','Kennis','Variatie','Relevantie','Authenticiteit','Actualiteit','Kwantiteit','Soort']
    const example = {
      Naam: 'Voorbeeld sjabloon',
      EVL: allCodes.slice(0,2).join(', '),
      Casussen: (course.cases[0]?.name)||'',
      Kennis: (course.knowledgeDomains[0]?.name)||'',
      Variatie: 3,
      Relevantie: 3,
      Authenticiteit: 3,
      Actualiteit: 3,
      Kwantiteit: 3,
      Soort: 'document'
    } as any
    const ws = XLSX.utils.json_to_sheet([example], { header: headers })
    // Zorg dat koprij de juiste headerlabels krijgt
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sjablonen')
    const filename = `Sjablonen-${course.name.replace(/\s+/g,'_')}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  return (
    <div style={{padding:20}}>
      <h1>Admin</h1>
      <p className="muted">Download Excel-sjablonen per cursus om veelgebruikte bewijsstukken te beheren.</p>
      <ul style={{listStyle:'none', padding:0}}>
        {courses.map(c => (
          <li key={c.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid rgba(255,255,255,.1)', padding:'12px 0'}}>
            <div>
              <div style={{fontWeight:600}}>{c.name}</div>
              <div className="muted" style={{fontSize:12}}>Casussen: {c.cases.length} · Kennis: {c.knowledgeDomains.length}</div>
            </div>
            <div>
              <button className="file-label" onClick={()=>generateTemplate(c.id)}>Download sjablonen (Excel)</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="muted" style={{marginTop:12, fontSize:12}}>
        Kolommen in het Excel-bestand: Naam, EVL (bijv. "1.2, 2.1"), Casussen, Kennis, Variatie, Relevantie, Authenticiteit, Actualiteit, Kwantiteit.
      </div>
    </div>
  )
}


