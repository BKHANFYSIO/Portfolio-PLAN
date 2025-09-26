import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __root = path.resolve(path.dirname(__filename), '..')

async function ensureDir(p){
  try{ await fs.mkdir(p, { recursive: true }) }catch{}
}

async function listExcelFiles(dir){
  try{
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile())
      .map(e => e.name)
    .filter(name => /\.(xlsx|xls)$/i.test(name))
    .filter(name => !name.startsWith('~$'))
      .sort((a,b)=> a.localeCompare(b, undefined, { numeric:true, sensitivity:'base' }))
  }catch{
    return []
  }
}

async function writeJson(targetFile, data){
  const json = JSON.stringify(data, null, 2)
  await fs.writeFile(targetFile, json + '\n', 'utf8')
}

async function generateJaarplanningenIndex(){
  const publicDir = path.join(__root, 'public')
  const jaarDir = path.join(publicDir, 'Jaarplanningen')
  const outFile = path.join(jaarDir, 'index.json')
  await ensureDir(jaarDir)
  const files = await listExcelFiles(jaarDir)
  const relPaths = files.map(f => `Jaarplanningen/${f}`)
  await writeJson(outFile, relPaths)
  return { outFile, count: relPaths.length }
}

async function generateCursusInfoIndex(){
  const publicDir = path.join(__root, 'public')
  const dir = path.join(publicDir, 'Cursus-info')
  const outFile = path.join(dir, 'index.json')
  await ensureDir(dir)
  const files = await listExcelFiles(dir)
  const relPaths = files.map(f => `Cursus-info/${f}`)
  await writeJson(outFile, relPaths)
  return { outFile, count: relPaths.length }
}

async function generateSjablonenIndex(){
  const publicDir = path.join(__root, 'public')
  const dir = path.join(publicDir, 'Sjablonen')
  const outFile = path.join(dir, 'index.json')
  await ensureDir(dir)
  const files = await listExcelFiles(dir)
  const relPaths = files.map(f => `Sjablonen/${f}`)
  await writeJson(outFile, relPaths)
  return { outFile, count: relPaths.length }
}

async function main(){
  const watch = process.argv.includes('--watch')
  const once = async ()=>{
    const a = await generateJaarplanningenIndex()
    process.stdout.write(`[gen] Wrote ${a.count} jaarplanning(en) to ${path.relative(__root, a.outFile)}\n`)
    const b = await generateCursusInfoIndex()
    process.stdout.write(`[gen] Wrote ${b.count} cursus-info file(s) to ${path.relative(__root, b.outFile)}\n`)
    const c = await generateSjablonenIndex()
    process.stdout.write(`[gen] Wrote ${c.count} sjabloonbestand(en) to ${path.relative(__root, c.outFile)}\n`)
  }
  await once()
  if(!watch) return

  // Lazy optional watch via chokidar if available; fall back to simple interval
  try{
    const { watch: chokidarWatch } = await import('chokidar')
    const watchDirs = [
      path.join(__root, 'public', 'Jaarplanningen'),
      path.join(__root, 'public', 'Cursus-info'),
      path.join(__root, 'public', 'Sjablonen'),
    ]
    const watcher = chokidarWatch(watchDirs, { ignoreInitial:true })
    watcher.on('add', once).on('unlink', once).on('change', once)
    for(const wd of watchDirs){
      process.stdout.write(`[gen] Watching ${path.relative(__root, wd)} for changes...\n`)
    }
  }catch{
    process.stdout.write('[gen] chokidar not installed, falling back to 5s interval watch...\n')
    setInterval(once, 5000)
  }
}

main().catch(err=>{ console.error(err); process.exit(1) })


