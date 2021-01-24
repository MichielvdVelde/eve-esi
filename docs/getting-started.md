# Getting Started

## Install

Install the module through `npm`:

```
npm i eve-esi-client [--save]
```

The module requires [eve-sso](https://github.com/MichielvdVelde/eve-sso)
as a peer dependency, meaning you will need to install it yourself.

## Create an Application

Before you can use this module you need to create an application
at the Eve Online Developers section.

* [Go to the Eve Online Developers section](https://developers.eveonline.com/)

After you have created a new application you receive the client ID
and secret.

## Set up ESI

The example below shows how to create a client instance
using the client ID, secret, and callback URI.

To instantiate a client you also need a `Provider`. The
provider is responsible for managing accounts, characters,
and tokens. The example below uses the built-in `MemoryProvider`.

An example of a provider is the [MongoDB Provider](https://github.com/MichielvdVelde/eve-esi-client-mongo-provider).

```typescript
import ESI from 'eve-esi-client'
import MemoryProvider from 'eve-esi-client/dist/providers/memory'

const provider = new MemoryProvider()
const esi = new ESI({
    provider,
    clientId: '<your client id>',
    secretKey: '<your secret key>',
    callbackUri: '<your callback uri>'
})
```

## Showing the redirect URL

The redirect url requires a `state`, which you may
use in the callback to verify the request, or use it
as a temporary session store key.

The redirect url also defines which scopes, if any,
are requested. To find out which scopes you will need
for your application you can check out the
[Eve Swagger UI](https://esi.evetech.net/ui).

In the below example we use a `koa` router.

```typescript
import Koa from 'koa'
import Router from 'koa-router'

const app = new Koa()
const router = new Router()

router.get('/', async ctx => {
    // Create a redirect url for the given state and scope(s)
    const redirectUrl = esi.getRedirectUrl(
        'some-state',
        [ 'esi-skills.read_skills.v1' ]
    )

    // Show the link to the user
    ctx.body = `<a href="${redirectUrl}">Log in with Eve Online</a>`
})
```

## Handling the callback

Eve SSO will call your `callbackUri` when a request has
been successful. A one-time access code can then be
exchanged for an access token.

The access token is then registered with the provider,
so it can be used.

```typescript
router.get('/callback', async ctx => {
    const code: string = ctx.query.code
    const {
        account,
        character,
        token
    } = await esi.register(code)

    ctx.body = `<h1>Welcome, ${character.characterName}!</h1>`
})
```

## Making an authenticated request

To make authenticated requests, use a token.

The below example requests the character's skills,
and shows how to use an interface for type definitions.

```typescript
interface Skills {
  skills: [{
    skill_id: number,
    active_skill_level: number
  }],
  total_sp: number,
  unallocated_sp: number
}

router.get('/skills/:characterId', async ctx => {
    const token = await provider.getToken(
        Number(ctx.params.characterId),
        'esi-skills.read_skills.v1'
    )

    // Make the request
    const response = await esi.request<Skills>(
        // request uri
        `/characters/${character.characterId}/skills/`,
        // request query
        null,
        // request body
        null,
        // request options
        { token }
    )

    // Get the body
    const body = await response.json()

    ctx.body = `You have ${body.total_sp} skill points.`
})
```