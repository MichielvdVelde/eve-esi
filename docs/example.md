# Example

This example uses [`koa`](https://github.com/koajs/koa) to run
a web server which allows the user to log in with the requested
scope. An authenticated call, using the requested token, is used
to display the authenticated character's skill points.

```typescript
'use strict'

import ESI from './index'
import MemoryProvider from './providers/memory'

import Koa from 'koa'
import Router from 'koa-router'

const provider = new MemoryProvider()

const esi = new ESI({
  provider,
  clientId: '<your client id>',
  secretKey: '<your secret>',
  callbackUri: '<your callback uri>'
})

const app = new Koa()
const router = new Router()

router.get('/', async ctx => {
  const redirectUrl = esi.getRedirectUrl('some-state', 'esi-skills.read_skills.v1')

  ctx.body = `<a href="${redirectUrl}">Log in using Eve Online</a>`
})

router.get('/sso', async ctx => {
  const code: string = ctx.query.code
  const { character } = await esi.register(code)

  ctx.res.statusCode = 302
  ctx.res.setHeader('Location', `/welcome/${character.characterId}`)
})

interface Skills {
  skills: [{
    skill_id: number,
    active_skill_level: number
  }],
  total_sp: number,
  unallocated_sp: number
}

router.get('/welcome/:characterId', async ctx => {
  const characterId = Number(ctx.params.characterId)
  const character = await provider.getCharacter(characterId)
  const token = await provider.getToken(characterId, 'esi-skills.read_skills.v1')

  let body = `<h1>Welcome, ${character.characterName}!</h1>`

  const response = await esi.request<Skills>(
    `/characters/${characterId}/skills/`,
    null,
    null,
    { token }
  )

  const skills = await response.json()

  body += `<p>You have ${skills.total_sp} total skill points.</p><ul>`

  for (const skill of skills.skills) {
    body += `<li>${skill.skill_id}: ${skill.active_skill_level}</li>`
  }
  
  body += '</ul>'

  ctx.body = body
})

app.use(router.middleware())
app.listen(3001, () => {
  console.log('- Server listening')
})
```