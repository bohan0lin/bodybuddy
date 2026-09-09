import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),embed:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc:mocks.rpc})}))
vi.mock('ai',()=>({embedMany:mocks.embed}))
vi.mock('@ai-sdk/google',()=>({google:{textEmbedding:()=> 'embedding-model'}}))
const candidate={id:'1',name:'Milk',name_en:'Milk',unit:'ml',base_amount:100,protein:3,carbs:5,fat:3,calories:60,distance:0,source:'synthetic'}
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubEnv('SUPABASE_URL','http://127.0.0.1:54321');vi.stubEnv('SUPABASE_ANON_KEY','synthetic');mocks.embed.mockResolvedValue({embeddings:[[1,0]]})})
it('uses exact matches without an embedding call and passes metadata filters',async()=>{
  mocks.rpc.mockResolvedValue({data:[candidate],error:null})
  const {lookupFoods}=await import('./rag.js')
  expect((await lookupFoods([{name:'Milk',brand:'A',unit:'l'}]))[0]).toMatchObject({method:'exact',unit:'ml'})
  expect(mocks.rpc).toHaveBeenCalledWith('find_foods_exact',expect.objectContaining({p_brand:'A',p_unit:'ml'}))
  expect(mocks.embed).not.toHaveBeenCalled()
})
it('does not guess between duplicate exact aliases',async()=>{
  mocks.rpc.mockResolvedValue({data:[candidate,{...candidate,id:'2'}],error:null})
  const {lookupFoods}=await import('./rag.js')
  expect(await lookupFoods(['Milk'])).toEqual([null]);expect(mocks.embed).not.toHaveBeenCalled()
})
it('falls back to semantic candidates and rejects near ties',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({data:[{...candidate,distance:0.2},{...candidate,id:'2',distance:0.21}],error:null})
  const {lookupFoods}=await import('./rag.js')
  expect(await lookupFoods(['dairy drink'])).toEqual([null]);expect(mocks.embed).toHaveBeenCalledOnce()
})
it('does not score backend failure as a no-match during evaluation',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:'offline'}})
  const {lookupFoods}=await import('./rag.js')
  await expect(lookupFoods(['unknown'],undefined,{strict:true})).rejects.toThrow('unavailable')
  expect(await lookupFoods(['unknown'])).toEqual([null])
})
