# Reference

```typescript
/*
 Create a new ESI instance
*/
const esi = new ESI({
  provider: Provider,
  clientId: string,
  secretKey: string,
  callbackUri: string,
  userAgent?: string,
  endpoint?: string
})

/*
 Get a redirect url with the requested scope(s)
*/
public getRedirectUrl (
  state: string,
  scopes?: string | string[]
): string

/*
 Register an authentication or refresh token
*/
public async register (
  code: string
): Promise<{
  account: Account,
  character: Character,
  token: Token
}>

/*
 Make a request to ESI
*/
public async request<T = any> (
  uri: string,
  query?: { [key: string]: any },
  body?: { [key: string]: any },
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
    statusCodes?: number[],
    headers?: { [key: string]: any }
    token?: Token
  } = {}
): Promise<Response<T>>
```