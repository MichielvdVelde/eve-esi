# Providers

A `Provider` is a flexible, storage-agnostic interface
for the management of accounts, characters, and tokens.

Any object/class that extends the `Provider` interface
correctly can serve as provider.

```typescript
export interface Provider<
  A extends Account = Account,
  C extends Character = Character,
  T extends Token = Token> {
  getAccount (owner: string, onLogin?: boolean): Promise<A>,
  getCharacter (characterId: number, onLogin?: boolean): Promise<C>,
  getToken (characterId: number, scopes?: string | string[]): Promise<T>,

  createAccount (owner: string): Promise<A>,
  createCharacter (owner: string, characterId: number, characterName: string): Promise<C>
  createToken (characterId: number, accessToken: string, refreshToken: string, expires: Date, scopes?: string | string[]): Promise<T>,

  deleteAccount (owner: string): Promise<void>,
  deleteCharacter (characterId: number): Promise<void>,
  deleteToken (accessToken: string): Promise<void>
}
```

## Built-in Providers

### Memory Provider

This provider stores credentials in-memory for ease of use.
This provider can be used as a reference implementation.
Usage of this provider in production is discouraged.

```typescript
import MemoryProvider from 'eve-esi-client/dist/providers/memory'
```

## External Providers

* [MongoDB Provider](https://github.com/MichielvdVelde/eve-esi-client-mongo-provider)