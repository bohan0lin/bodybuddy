import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDatabase } from './local.mjs'

test('exact aliases, metadata filters and semantic candidates respect unit and preparation boundaries', async () => {
  const db = await localDatabase()
  const embedding = JSON.stringify([1, ...Array(767).fill(0)])
  try {
    await db.query('begin')
    await db.query('delete from foods')
    for (const [name,unit,brand,preparation] of [['Test milk','ml','A','liquid'],['Test milk powder','g','B','powder']]) {
      await db.query("insert into foods(name,name_en,aliases,unit,brand,preparation,source,protein,carbs,fat,calories,embedding) values($1,$1,'test dairy',$2,$3,$4,'synthetic integration fixture',1,1,1,10,$5)", [name,unit,brand,preparation,embedding])
    }
    await db.query('set local role anon')
    const exact = async (...args) => (await db.query('select * from find_foods_exact($1,$2,$3,$4)', args)).rows
    assert.equal((await exact(' TEST MILK ',null,null,null))[0].name,'Test milk')
    assert.equal((await exact('test dairy',null,null,null)).length,2)
    assert.equal((await exact('test dairy','B','powder','g'))[0].name,'Test milk powder')
    assert.equal((await exact('test dairy','B',null,'ml')).length,0)
    assert.equal((await db.query('select * from find_foods_semantic($1,null,null,$2)',[embedding,'ml'])).rows[0].name,'Test milk')
  } finally { await db.query('rollback'); await db.end() }
})
