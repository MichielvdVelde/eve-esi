'use strict'

import {
  Provider,
  Account,
  Character,
  Token
} from '../index'

export default class MemoryProvider implements Provider {
  public readonly accounts: Map<string, Account> = new Map()
  public readonly characters: Map<number, Character> = new Map()
  public readonly tokens: Map<number, Token[]> = new Map()

  public async getAccount (
    owner: string,
    onLogin?: boolean
  ) {
    return this.accounts.get(owner)
  }

  public async getCharacter (
    characterId: number,
    onLogin?: boolean
  ) {
    return this.characters.get(characterId)
  }

  public async getToken (
    characterId: number,
    scopes?: string | string[]
  ) {
    const tokens = this.tokens.get(characterId)

    if (!tokens) {
      return
    }

    if (typeof scopes === 'string') {
      scopes = scopes.split(' ')
    }

    const inputScopes = scopes.concat().sort()
    for (const token of tokens) {
      if ((!scopes || !scopes.length) && (!token.scopes || !token.scopes.length)) {
        return token
      }

      if (inputScopes.length !== token.scopes.length) {
        continue
      }

      let isSame = true
      const tokenScopes = token.scopes.concat().sort()

      for (let i = 0; i < inputScopes.length; i++) {
        if (inputScopes[i] !== tokenScopes[i]) {
          isSame = false
          break
        }
      }

      if (isSame) {
        return token
      }
    }
  }

  public async createAccount (
    owner: string
  ) {
    const account = { owner }
    this.accounts.set(owner, account)
    return account
  }

  public async createCharacter (
    owner: string,
    characterId: number,
    characterName: string
  ) {
    const character: any = {
      owner,
      characterId,
      characterName
    }

    character.update = async (
      owner: string,
      characterName: string
    ) => {
      character.owner = owner
      character.characterName = characterName
      return character
    }

    character.deleteTokens = async () => {
      this.tokens.delete(character.characterId)
    }

    this.characters.set(characterId, character)

    return character
  }

  public async createToken (
    characterId: number,
    accessToken: string,
    refreshToken: string,
    expires: Date,
    scopes?: string | string[]
  ) {
    if (!scopes) {
      scopes = []
    }

    if (typeof scopes === 'string') {
      scopes = scopes.split(' ')
    }

    const token: any = {
      characterId,
      accessToken,
      refreshToken,
      expires,
      scopes
    }

    token.update = async (
      accessToken: string,
      refreshToken: string,
      expires: Date,
      scopes?: string | string[]
    ) => {
      if (!scopes) {
        scopes = []
      }

      if (typeof scopes === 'string') {
        scopes = scopes.split(' ')
      }

      token.accessToken = accessToken
      token.refreshToken = refreshToken
      token.expires = expires
      token.scopes = scopes

      return token
    }

    if (!this.tokens.get(characterId)) {
      this.tokens.set(characterId, [])
    }

    this.tokens.get(characterId).push(token)

    return token
  }
}
