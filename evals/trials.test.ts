import { expect,it } from 'vitest'
import { analyzeTrials } from './trials'
const row={participantId:'p1',taskId:'t1',beforeSeconds:20,afterSeconds:10,beforeCompleted:true,afterCompleted:true,order:'before-first'}
it('computes paired medians without treating failed tasks as completed',()=>{
  expect(analyzeTrials([row,{...row,taskId:'t2',beforeSeconds:40,afterSeconds:20},{...row,taskId:'t3',afterCompleted:false}])).toMatchObject({totalPairs:3,completedPairs:2,medianBeforeSeconds:30,medianAfterSeconds:15,medianPairedSecondsSaved:15,afterCompletionRate:2/3})
})
it('rejects duplicate trials and invalid timings',()=>{
  expect(()=>analyzeTrials([row,row])).toThrow('Duplicate')
  expect(()=>analyzeTrials([{...row,beforeSeconds:-1}])).toThrow()
})
