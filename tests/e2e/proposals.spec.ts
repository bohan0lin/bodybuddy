import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url=process.env.E2E_SUPABASE_URL!
const admin=createClient(url,process.env.E2E_SERVICE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
let userId:string, client:SupabaseClient, id:string
test.beforeEach(async ({page}) => {
  const email=`e2e-${randomUUID()}@example.test`, password=randomUUID()+'aA1!'
  const result=await admin.auth.admin.createUser({email,password,email_confirm:true})
  if(result.error || !result.data.user) throw new Error('Could not create disposable E2E user')
  userId=result.data.user.id; id=randomUUID()
  client=createClient(url,process.env.E2E_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
  if((await client.auth.signInWithPassword({email,password})).error) throw new Error('Local test sign-in failed')
  await page.addInitScript(() => localStorage.setItem('bodybuddy:lang','en'))
  await page.goto('/')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.getByRole('button',{name:'Coach',exact:true}).click()
  await expect(page.getByPlaceholder('Ask me, or say "log …"')).toBeVisible()
})
test.afterEach(async () => { if(userId) { const {error}=await admin.auth.admin.deleteUser(userId); if(error) throw new Error('Disposable user cleanup failed') } })
async function propose(page:Page,kind='log') {
  await page.getByPlaceholder('Ask me, or say "log …"').fill(`fixture:${kind}:${id}`)
  await page.getByRole('button',{name:'↑',exact:true}).click()
  await expect(page.getByRole('region',{name:'Proposal for review'}).first()).toBeVisible()
}
async function records(table='meals') { const {data,error}=await client.from(table).select('*'); if(error)throw error; return data! }
async function confirm(page:Page) { await page.getByRole('button',{name:'Confirm and save',exact:true}).click(); await expect(page.getByText('Saved',{exact:true})).toBeVisible() }

test('01 proposal generation performs no writes',async({page})=>{ await propose(page); expect(await records()).toHaveLength(0); expect(await records('agent_actions')).toHaveLength(0) })
test('02 meal confirmation persists the reviewed record',async({page})=>{ await propose(page); await confirm(page); expect((await records())[0]).toMatchObject({id,name:'E2E rice',calories:130}); await page.reload(); expect(await records()).toHaveLength(1) })
test('03 editing a meal saves the edited content',async({page})=>{ await propose(page); await page.getByLabel('Name',{exact:true}).fill('Edited rice'); await page.getByLabel('Calories (kcal)').fill('150'); await confirm(page); expect((await records())[0]).toMatchObject({name:'Edited rice',calories:150}) })
test('04 cancellation performs no writes',async({page})=>{ await propose(page); await page.getByRole('button',{name:'Cancel proposal'}).click(); await expect(page.getByText('Cancelled; nothing saved')).toBeVisible(); expect(await records()).toHaveLength(0) })
test('05 favorite confirmation persists a favorite only',async({page})=>{ await propose(page,'save'); await confirm(page); expect(await records('saved_items')).toHaveLength(1); expect(await records()).toHaveLength(0) })
test('06 favorite portion and unit are editable',async({page})=>{ await propose(page,'save'); await page.getByLabel('Amount',{exact:true}).fill('200'); await page.getByLabel('Unit',{exact:true}).fill('ml'); await confirm(page); expect((await records('saved_items'))[0]).toMatchObject({base_amount:200,unit:'ml'}) })
test('07 workout confirmation persists a workout only',async({page})=>{ await propose(page,'workout'); await confirm(page); expect((await records('workouts'))[0]).toMatchObject({type:'walk',duration_min:30}); expect(await records()).toHaveLength(0) })
test('08 workout type and duration are editable',async({page})=>{ await propose(page,'workout'); await page.getByLabel('Workout type').selectOption('run'); await page.getByLabel('Duration (minutes)').fill('45'); await confirm(page); expect((await records('workouts'))[0]).toMatchObject({type:'run',duration_min:45}) })
test('09 cancelling a workout creates no receipt',async({page})=>{ await propose(page,'workout'); await page.getByRole('button',{name:'Cancel proposal'}).click(); expect(await records('workouts')).toHaveLength(0); expect(await records('agent_actions')).toHaveLength(0) })
test('10 rapid double confirmation creates one record',async({page})=>{ await propose(page); await page.getByRole('button',{name:'Confirm and save'}).dblclick(); await expect(page.getByText('Saved',{exact:true})).toBeVisible(); expect(await records()).toHaveLength(1) })
test('11 lost acknowledgement retries without duplicate records',async({page})=>{
  let first=true
  await page.route('**/rest/v1/rpc/confirm_agent_action',async route=>{ if(first){first=false;await route.fetch();await route.abort('failed')}else await route.continue() })
  await propose(page); await page.getByRole('button',{name:'Confirm and save'}).click(); await expect(page.getByRole('alert')).toBeVisible()
  expect(await records()).toHaveLength(1); await page.getByRole('button',{name:'Retry',exact:true}).click(); await expect(page.getByText('Saved',{exact:true})).toBeVisible(); expect(await records()).toHaveLength(1)
})
test('12 conflicting content never overwrites an existing action',async({page})=>{
  await propose(page)
  const date=await page.getByLabel('Date',{exact:true}).inputValue()
  const result=await client.rpc('confirm_agent_action',{p_action_id:id,p_payload:{date,action:{type:'log',name:'Other tab',mealType:'lunch',amount:100,unit:'g',protein:3,carbs:28,fat:1,calories:999}}})
  expect(result.error).toBeNull(); await page.getByRole('button',{name:'Confirm and save'}).click(); await expect(page.getByRole('alert')).toContainText('different content'); expect((await records())[0].calories).toBe(999)
})
test('13 invalid quantities cannot be confirmed',async({page})=>{ await propose(page); await page.getByLabel('Amount',{exact:true}).fill('-1'); await expect(page.getByRole('button',{name:'Confirm and save'})).toBeDisabled(); expect(await records()).toHaveLength(0) })
test('14 multiple proposals are confirmed and cancelled independently',async({page})=>{ await propose(page,'multi'); const cards=page.getByRole('region',{name:'Proposal for review'}); await cards.nth(0).getByRole('button',{name:'Confirm and save'}).click(); await expect(cards.nth(0).getByText('Saved',{exact:true})).toBeVisible(); await cards.nth(1).getByRole('button',{name:'Cancel proposal'}).click(); expect(await records()).toHaveLength(1) })
test('15 photo conversation still requires explicit confirmation',async({page})=>{
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6aV8AAAAASUVORK5CYII=','base64')})
  await expect(page.getByText('Photo attached')).toBeVisible(); await propose(page); expect(await records()).toHaveLength(0); await confirm(page); expect(await records()).toHaveLength(1)
})
