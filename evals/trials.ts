import { z } from 'zod'
const trialSchema=z.object({ participantId:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),taskId:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  beforeSeconds:z.number().positive(),afterSeconds:z.number().positive(),beforeCompleted:z.boolean(),afterCompleted:z.boolean(),order:z.enum(['before-first','after-first']) }).strict()
function median(values:number[]) { const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2 }
export function analyzeTrials(input:unknown) {
  const trials=z.array(trialSchema).min(1).parse(input)
  const keys=trials.map(t=>t.participantId+'/'+t.taskId)
  if(new Set(keys).size!==keys.length)throw new Error('Duplicate participant/task pair')
  const completed=trials.filter(t=>t.beforeCompleted&&t.afterCompleted)
  return { participants:new Set(trials.map(t=>t.participantId)).size,totalPairs:trials.length,completedPairs:completed.length,
    beforeCompletionRate:trials.filter(t=>t.beforeCompleted).length/trials.length,afterCompletionRate:trials.filter(t=>t.afterCompleted).length/trials.length,
    medianBeforeSeconds:completed.length?median(completed.map(t=>t.beforeSeconds)):null,
    medianAfterSeconds:completed.length?median(completed.map(t=>t.afterSeconds)):null,
    medianPairedSecondsSaved:completed.length?median(completed.map(t=>t.beforeSeconds-t.afterSeconds)):null,
    counterbalanced:trials.some(t=>t.order==='before-first')&&trials.some(t=>t.order==='after-first'),
    limitation:'Completed-pair timing excludes failed tasks; completion rates and excluded count must be reported alongside it. No causal or population-level claim is established.' }
}
