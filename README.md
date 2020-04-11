# Eve Online ESI Client

***Very much a work-in-progress!***

Not published to npm yet. To use the module, clone the repository.

This module makes use of my other Eve related module, [eve-sso](https://github.com/MichielvdVelde/eve-sso).
Documentation is lacking, see the source code for guidance if you're brave enough
to try it out.

## Features

* Make authenticated GET requests
* Make authenticated POST requests
* Automatically checks token validity/expiry and refreshes the access token when needed

## Missing

* Caching
* Paging
* And much more I'm sure

## Example

Or: how not to use this module.

```ts
import Koa from 'koa'
import Router from 'koa-router'
import jwt from 'jsonwebtoken'

import SingleSignOn from 'eve-sso'
import ESI from './index'

// For the sake of this example
// the character ID and class instance are defined here
// In actual use you want to instantiate the class for each access token/character
let characterId: number
let esi: ESI

// Application credentials for SSO
const CLIENT_ID = 'clientId'
const SECRET = 'secretKey'
const CALLBACK_URI = 'callbackUri'

const app = new Koa()
const router = new Router()

// Create an instance of eve-sso with requested scopes
const sso = new SingleSignOn(CLIENT_ID, SECRET, CALLBACK_URI, {
  scopes: 'esi-assets.read_assets.v1'
})

// Display a login link
router.get('/', async ctx => {
  ctx.body = `<a href="${sso.getRedirectUrl('my-state')}">Login Eve Online</a>`
})

// The SSO/oAuth callback url - this is defined in the developer section
// and when instantiating eve-sso (see above)
router.get('/sso', async ctx => {
  const code: string = ctx.query.code
  // Get an access token for the given code
  const reply = await sso.getAccessToken(code)

  const decoded = jwt.decode(reply.access_token) as { name: string, sub: string }

  // Store the character ID
  characterId = Number(decoded.sub.split(':').pop())
  
  // Create a class instance for this access token
  esi = new ESI(sso, {
    accessToken: reply.access_token,
    refreshToken: reply.refresh_token
  }, {
    updateRefreshToken: async (oldToken, newToken) => {
      // this method is called every time a new refresh token is issued
      // use this to update your (database) records
    }
  })

  // Redirect the user - to their assets, in this case
  ctx.status = 302
  ctx.res.setHeader('Location', '/assets')
  ctx.body = `Logged in, ${decoded.name}! Redirecting...`
})

// Displays the logged in user's assets
router.get('/assets', async ctx => {
  if (!characterId || !esi) {
    ctx.body = 'No character set!'
    return
  }

  // Make an authenticated GET request to ESI
  const reply = await esi.makeAuthenticatedGetRequest<any>(
    `/characters/${characterId}/assets/`
  )

  ctx.body = reply
})

app.use(router.middleware())
app.listen(3001, () => {
  console.log('Server listening on port 3001\n')
})
```

## License

Copyright 2020 Michiel van der Velde.

This software is licensed under [the MIT License](LICENSE).
