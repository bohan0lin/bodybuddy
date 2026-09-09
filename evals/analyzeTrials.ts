import { readFile } from 'node:fs/promises'
import { analyzeTrials } from './trials'
const path=process.argv[2]
if(!path)throw new Error('Provide the path to a pseudonymous paired-trial JSON file')
console.log(JSON.stringify(analyzeTrials(JSON.parse(await readFile(path,'utf8'))),null,2))
