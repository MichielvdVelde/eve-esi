# Eve Online ESI Client

Node.js client for Eve Online ESI. Allows you to manage characters and tokens,
and make authenticated and unauthenticated requests.
This module makes use of my other Eve related module, [eve-sso](https://github.com/MichielvdVelde/eve-sso).

Before using the module you must create an application in the
[Eve Online developers section](https://developers.eveonline.com/). This will
give you the required client ID and secret.

## Features

* Manage accounts, characters, and tokens with an easy to extend interface
* Make authenticated and unauthenticated requests to ESI
* Automatically refreshes and updates tokens when necessary

## Install

```
npm i eve-esi-client [--save]
```

## Documentation

[Click here to view the documentation](https://michielvdvelde.github.io/eve-esi/).

## Example

This example shows how to authenticate a character and make a request.

The accompanied memory provider is meant solely for development, you should not
use it in production. It can also be used as a reference implementation.

See the [MongoDB provider](https://github.com/MichielvdVelde/eve-esi-client-mongo-provider)
for a more robust provider.

```ts
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

## License

Copyright 2020-2021 Michiel van der Velde.

This software is licensed under [the MIT License](LICENSE).
