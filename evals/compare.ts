import { readFile } from 'node:fs/promises'
import type { Row } from './scoring'
interface Report { manifest: { dataset:string; versions:Record<string,string> }; rows:Row[] }
const [beforePath,afterPath]=process.argv.slice(2)
if(!beforePath || !afterPath) throw new Error('Usage: npm run eval:compare -- baseline/report.json candidate/report.json')
const [before,after]=await Promise.all([beforePath,afterPath].map(async path=>JSON.parse(await readFile(path,'utf8')) as Report))
if(before.manifest.versions['evals/dataset.ts']!==after.manifest.versions['evals/dataset.ts'] || before.manifest.versions['scripts/foods.json']!==after.manifest.versions['scripts/foods.json']) throw new Error('Dataset and catalog must match for a paired comparison')
const key=(row:Row)=>row.suite+'/'+row.config+'/'+row.id
const baseline=new Map(before.rows.map(row=>[key(row),row]))
if(!after.rows.length || baseline.size!==after.rows.length || before.rows.some(row=>row.status==='inconclusive') || after.rows.some(row=>row.status==='inconclusive')) throw new Error('Both reports must be complete, scored runs of the same cases')
const deltas=after.rows.map(row=>{
  const previous=baseline.get(key(row));if(!previous)throw new Error('Mismatched case/configuration')
  return {id:key(row),before:previous.status,after:row.status,latencyDeltaMs:row.latencyMs-previous.latencyMs}
})
console.log(JSON.stringify({improvements:deltas.filter(d=>d.before==='fail'&&d.after==='pass').length,regressions:deltas.filter(d=>d.before==='pass'&&d.after==='fail').length,
  wrongAcceptedMatches:{before:before.rows.filter(r=>r.incorrectMatch).length,after:after.rows.filter(r=>r.incorrectMatch).length},cases:deltas},null,2))
