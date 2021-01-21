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

    for (const token of tokens) {
      if ((!scopes || !scopes.length) && (!token.scopes || !token.scopes.length)) {
        return token
      }

      if (scopes.every(scope => token.scopes.includes(scope))) {
        return token
      }
    }
  }

  public async createAccount (
    owner: string
  ) {
    const account: any = {
      owner
    }

    account.deleteAccount = async () => {
      this.accounts.delete(owner)
    }

    account.deleteCharacters = async () => {
      for (const [ characterId, character ] of this.characters) {
        if (character.owner === owner) {
          this.characters.delete(characterId)
        }
      }
    }

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

    character.updateCharacter = async (
      owner: string,
      characterName: string
    ) => {
      character.owner = owner
      character.characterName = characterName
    }

    character.deleteTokens = async () => {
      this.tokens.delete(character.characterId)
    }

    character.deleteCharacter = async () => {
      this.characters.delete(characterId)
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

    token.updateToken = async (
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
    }

    token.deleteToken = async () => {
      const tokens = this.tokens.get(token.characterId)

      if (!tokens || !tokens.length) {
        return
      }

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].accessToken === accessToken) {
          tokens.splice(i)
          return
        }
      }
    }

    if (!this.tokens.get(characterId)) {
      this.tokens.set(characterId, [])
    }

    this.tokens.get(characterId).push(token)
    return token
  }

  public async deleteAccount (
    owner: string
  ) {
    this.accounts.delete(owner)
  }

  public async deleteCharacter (
    characterId: number
  ) {
    this.characters.delete(characterId)
    this.tokens.delete(characterId)
  }

  public async deleteToken (
    accessToken: string
  ) {
    if (!this.characters.size) {
      return
    }

    for (const character of this.characters.values()) {
      const tokens = this.tokens.get(character.characterId)

      if (!tokens || !tokens.length) {
        continue
      }

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].accessToken === accessToken) {
          await tokens[i].deleteToken()
          return
        }
      }
    }
  }
}
