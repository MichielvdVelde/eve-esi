# Reference

```typescript
/*
 Create a new ESI instance
*/
const esi = new ESI({
  provider: Provider,
  userAgent?: string
  sso?: SingleSignOn,
  clientId?: string,
  secretKey?: string,
  callbackUri?: string,
  scopes?: string | string[],
  endpoint?: string,
})

/*
 Get a redirect url with the requested scope(s)
*/
public getRedirectUrl (
  state: string,
  scopes?: string | string[]
)

/*
 Register an authentication or refresh token
 Possibly with a subset of requested scopes from `getRedirectUrl`
*/
public async register (
  code: string,
  isRefreshToken?: boolean,
  scopes?: string | string[]
)

/*
 Make a request to ESI
*/
public async request<T = { [key: string]: any }> (
  uri: string,
  query?: { [key: string]: any },
  body?: { [key: string]: any },
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
    statusCodes?: number[],
    headers?: { [key: string]: any }
    token?: Token
  } = {}
)
```