'use strict'

import { stringify } from 'querystring'

import formUrlencoded from 'form-urlencoded'
import bent from 'bent'
import SingleSignOn from 'eve-sso'

const { name, version, homepage } = require('../package')

export type Response<T> = bent.NodeResponse & { json: () => Promise<T> }

export interface Account {
  owner: string
}

export interface Character {
  owner: string,
  characterId: number,
  characterName: string,

  update (
    owner: string,
    characterName: string
  ): Promise<this>,

  deleteTokens (): Promise<void>
}

export interface Token {
  characterId: number,
  accessToken: string,
  refreshToken: string,
  expires: Date,
  scopes: string[],

  update (
    accessToken: string,
    refreshToken: string,
    expires: Date,
    scopes?: string | string[]
  ): Promise<this>
}

export interface Provider<
  A extends Account = Account,
  C extends Character = Character,
  T extends Token = Token> {
  getAccount (owner: string, onLogin?: boolean): Promise<A>,
  getCharacter (characterId: number, onLogin?: boolean): Promise<C>,
  getToken (characterId: number, scopes?: string | string[]): Promise<T>,

  createAccount (owner: string): Promise<A>,
  createCharacter (owner: string, characterId: number, characterName: string): Promise<C>
  createToken (characterId: number, accessToken: string, refreshToken: string, expires: Date, scopes?: string | string[]): Promise<T>
}

export interface Options {
  provider: Provider,
  userAgent?: string
  sso?: SingleSignOn,
  clientId?: string,
  secretKey?: string,
  callbackUri?: string,
  scopes?: string | string[],
  endpoint?: string,
}

export default class ESI {
  public readonly endpoint: string
  public readonly userAgent: string

  public readonly sso: SingleSignOn
  public readonly provider: Provider

  public constructor (options: Options) {
    if (!options.sso && (!options.clientId || !options.secretKey || !options.callbackUri)) {
      throw new TypeError('sso or clientId, secretKey, and callbackUri needs to be set')
    }

    this.userAgent = options.userAgent || options.sso ? options.sso.userAgent : `${name}@${version} - ${homepage}`

    this.sso = options.sso || new SingleSignOn(
      options.clientId,
      options.secretKey,
      options.callbackUri,
      {
        scopes: options.scopes,
        userAgent: this.userAgent
      }
    )

    this.endpoint = options.endpoint || 'https://esi.evetech.net/latest'
    this.provider = options.provider
  }

  public getRedirectUrl (
    state: string,
    scopes?: string | string[],
    sso?: SingleSignOn
  ) {
    return (sso || this.sso).getRedirectUrl(state, scopes)
  }

  public async register (
    code: string,
    isRefreshToken?: boolean,
    scopes?: string | string[],
    sso?: SingleSignOn
  ) {
    const response = await (sso || this.sso).getAccessToken(code, isRefreshToken, scopes)

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
      if (character.owner !== account.owner) {
        await character.deleteTokens()
      }

      await character.update(
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
      await token.update(
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

  public async request<T = { [key: string]: any }> (
    uri: string,
    query?: { [key: string]: any },
    payload?: { [key: string]: any },
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
      statusCodes?: number[],
      headers?: { [key: string]: any }
      token?: Token,
      sso?: SingleSignOn
    } = {}
  ): Promise<Response<T>> {
    const method = options.method || payload ? 'POST' : 'GET'
    // TODO: add default acceptable status codes for GET and POST/PUT requests
    const statusCodes = options.statusCodes || method === 'GET' ? [ 200 ] : [ 200, 201 ]
    let headers = options.headers || {}

    headers['User-Agent'] = this.userAgent

    if (options.token) {
      const { token } = options

      if (token.expires.getTime() <= Date.now()) {
        const response = await (options.sso || this.sso).getAccessToken(token.refreshToken, true)

        await token.update(
          response.access_token,
          response.refresh_token,
          new Date (Date.now() + (response.expires_in * 1000))
        )
      }

      headers['Authorization'] = `Bearer ${token.accessToken}`
    }

    let encodedPayload: string = null

    if (payload) {
      encodedPayload = formUrlencoded(payload)

      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      headers['Content-Length'] = Buffer.byteLength(encodedPayload)
    }

    let uriWithQuery: string = null

    if (query) {
      uriWithQuery = `${uri}?${stringify(query)}`
    }

    const request = bent(
      this.endpoint,
      method,
      ...statusCodes
    )

    return <any>request(uriWithQuery || uri, encodedPayload, headers)
  }
}
