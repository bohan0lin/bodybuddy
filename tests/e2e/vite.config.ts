import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createClient } from '@supabase/supabase-js'
import { requests } from '../../api/_lib/contracts.ts'
if (process.env.E2E_LOCAL_ONLY !== '1' || process.env.E2E_SUPABASE_URL !== 'http://127.0.0.1:54321') throw new Error('Local E2E only')
const sb = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_ANON_KEY!, { auth: { persistSession: false } })
export default defineConfig({
  envDir: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.E2E_SUPABASE_URL), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.E2E_ANON_KEY) },
  plugins: [react(), VitePWA({ devOptions: { enabled: false } }), {
    name: 'synthetic-model-responses',
    configureServer(server) {
      server.middlewares.use('/api/assistant', async (req,res) => {
        try {
          const token = req.headers.authorization?.replace(/^Bearer /,'')
          if (!token || (await sb.auth.getUser(token)).error) { res.statusCode=401; res.end(); return }
          let body=''; for await (const chunk of req) body += chunk
          const input=requests.assistant.parse(JSON.parse(body))
          const [prefix,kind,id] = input.messages.at(-1)!.text.split(':')
          if (prefix !== 'fixture' || !['log','save','workout','multi'].includes(kind)) throw new Error('Unknown fixture')
          const nutrition = { protein:3,carbs:28,fat:1,calories:130 }
          const meal = { type:'log',name:'E2E rice',mealType:'lunch',amount:100,unit:'g',...nutrition }
          const action=kind==='workout'?{type:'workout',workoutType:'walk',durationMin:30,calories:100}:kind==='save'?{type:'save',kind:'food',name:'E2E rice',baseAmount:100,unit:'g',...nutrition}:meal
          const actions=[{actionId:id,date:input.date,action}]
          if(kind==='multi') actions.push({actionId:crypto.randomUUID(),date:input.date,action:{...meal,name:'Second rice'}})
          res.setHeader('content-type','application/json'); res.end(JSON.stringify({reply:'Review this estimate before saving.',actions}))
        } catch { res.statusCode=400; res.end(JSON.stringify({error:'Invalid synthetic request'})) }
      })
    },
  }],
  server: { host:'127.0.0.1',port:5182,strictPort:true },
})
