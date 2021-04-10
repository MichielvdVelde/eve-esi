'use strict'

import { stringify } from 'querystring'
import { PassThrough } from 'stream'

import bent from 'bent'
import SingleSignOn from 'eve-sso'

const { name, version, homepage } = require('../package')

export interface Response<T> extends PassThrough {
    statusCode: number
    statusMessage: string
    headers: {
      [key: string]: any
    },
    json: () => Promise<T>
}

export interface Account {
  /** The owner of the account. */
  owner: string,

  /** Delete the account. */
  deleteAccount (): Promise<void>,
  /** Delete all characters belonging to this account. */
  deleteCharacters (): Promise<void>
}

export interface Character {
  /** The character owner. */
  owner: string,
  /** The character ID */
  characterId: number,
  /** The character name */
  characterName: string,

  /** Update the character. */
  updateCharacter (
    owner: string,
    characterName: string
  ): Promise<void>,

  /** Delete all tokens belonging to this character. */
  deleteTokens (): Promise<void>,
  /** Delete the character. */
  deleteCharacter (): Promise<void>
}

export interface Token {
  /** The character ID this token belongs to. */
  characterId: number,
  /** The access token. */
  accessToken: string,
  /** The refresh token. */
  refreshToken: string,
  /** The expiry date. */
  expires: Date,
  /** The scopes, if any */
  scopes?: string[],

  /** Update the token. */
  updateToken (
    accessToken: string,
    refreshToken: string,
    expires: Date,
    scopes?: string | string[]
  ): Promise<void>,

  /** Delete the token */
  deleteToken (): Promise<void>
}

export interface Provider<
  A extends Account = Account,
  C extends Character = Character,
  T extends Token = Token
> {
  /** Get the account belonging to this owner. */
  getAccount (owner: string, onLogin?: boolean): Promise<A>,
  /** Get the character belonging to this ID. */
  getCharacter (characterId: number, onLogin?: boolean): Promise<C>,
  /** Get a token for the character and scopes combination */
  getToken (characterId: number, scopes?: string | string[]): Promise<T>,

  /** Create a new account for this owner. */
  createAccount (owner: string): Promise<A>,
  /** Create a new character for this owner. */
  createCharacter (owner: string, characterId: number, characterName: string): Promise<C>,
  /** Create a new token for this character. */
  createToken (characterId: number, accessToken: string, refreshToken: string, expires: Date, scopes?: string | string[]): Promise<T>,

  /** Delete the account belonging to this owner. */
  deleteAccount (owner: string): Promise<void>,
  /** Delete the character with this ID. */
  deleteCharacter (characterId: number): Promise<void>,
  /** Delete the token with this access token. */
  deleteToken (accessToken: string): Promise<void>
}

export interface Options {
  provider: Provider,
  clientId: string,
  secretKey: string,
  callbackUri: string,
  userAgent?: string,
  endpoint?: string
}

export default class ESI {
  public readonly endpoint: string
  public readonly userAgent: string

  public readonly sso: SingleSignOn
  public readonly provider: Provider

  public constructor (options: Options) {
    this.userAgent = options.userAgent ?? `${name}@${version} - ${homepage}`
    this.endpoint = options.endpoint ?? 'https://esi.evetech.net/latest'
    this.provider = options.provider

    this.sso = new SingleSignOn(
      options.clientId,
      options.secretKey,
      options.callbackUri,
      {
        userAgent: this.userAgent
      }
    )
  }

  public getRedirectUrl (
    state: string,
    scopes?: string | string[]
  ) {
    return this.sso.getRedirectUrl(state, scopes)
  }

  public async register (
    code: string
  ) {
    const response = await this.sso.getAccessToken(code)

    const { provider } = this
    const { access_token, refresh_token, decoded_access_token, expires_in } = response
    const { owner, sub, scp, name } = decoded_access_token
    const characterId = Number(sub.split(':').pop())

    let account = await provider.getAccount(owner, true)

    if (!account) {
      account = await provider.createAccount(owner)
    }

    let character = await provider.getCharacter(characterId, true)

    if (!character) {
      character = await provider.createCharacter(
        owner,
        characterId,
        name
      )
    } else if (character.owner !== account.owner || character.characterName !== name) {
      await character.updateCharacter(
        owner,
        name
      )
    }

    let token = await provider.getToken(characterId, scp && scp.length ? scp : null)

    if (!token) {
      token = await provider.createToken(
        characterId,
        access_token,
        refresh_token,
        new Date(Date.now() + (expires_in * 1000)),
        scp && scp.length ? scp : null
      )
    } else {
      await token.updateToken(
        access_token,
        refresh_token,
        new Date(Date.now() + (expires_in * 1000))
      )
    }

    return {
      account,
      character,
      token
    }
  }

  public async request<T = any> (
    uri: string,
    query?: Record<string, any>,
    body?: Record<string, any> | any[],
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
      statusCodes?: number[],
      headers?: Record<string, any>,
      token?: Token
    } = {}
  ): Promise<Response<T>> {
    const method = options.method ?? body ? 'POST' : 'GET'
    const statusCodes = options.statusCodes || method === 'GET' ? [ 200 ] : [ 200, 201 ]
    const headers = options.headers ?? {}

    headers['User-Agent'] = this.userAgent

    if (options.token) {
      const { token } = options

      if (token.expires.getTime() <= Date.now()) {
        const response = await this.sso.getAccessToken(token.refreshToken, true)

        await token.updateToken(
          response.access_token,
          response.refresh_token,
          new Date (Date.now() + (response.expires_in * 1000))
        )
      }

      headers['Authorization'] = `Bearer ${token.accessToken}`
    }

    let encodedBody: string

    if (body) {
      try {
        encodedBody = JSON.stringify(body)
        headers['Content-Type'] = 'application/json'
      } catch (e) {
        throw new TypeError('Failed to serialize body')
      }
    }

    let uriWithQuery: string = null

    if (query) {
      uriWithQuery = `${uri}?${stringify(query)}`
    }

    return <any>bent(
      this.endpoint,
      method,
      ...statusCodes
    )(
      uriWithQuery ?? uri,
      encodedBody,
      headers
    )
  }
}
