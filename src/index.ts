'use strict'

import { stringify } from 'querystring'
import { parse } from 'url'

import bent from 'bent'
import SingleSignOn from 'eve-sso'
import jwt from 'jsonwebtoken'
import formUrlencoded from 'form-urlencoded'

const { name, version, homepage } = require('../package')

export interface AccessTokenPayload {
  scp: string[],
  jti: string,
  kid: string,
  sub: string,
  azp: string,
  name: string,
  owner: string,
  exp: number,
  iss: string
}

export interface ESITokens {
  refreshToken: string,
  accessToken?: string
}

export interface ESIOptions {
  updateRefreshToken?: (
    oldRefreshToken: string,
    newRefreshToken: string
  ) => Promise<void>,
  endpoint?: string,
  userAgent?: string
}

export default class ESI {
  public readonly sso: SingleSignOn
  public readonly userAgent: string
  public readonly endpoint: string

  #accessToken?: string
  #accessTokenPayload?: AccessTokenPayload
  #refreshToken: string

  private updateRefreshToken: (
    oldRefreshToken: string,
    newRefreshToken: string
  ) => Promise<void>

  #getRequest: bent.RequestFunction<bent.Json>
  #postRequest: bent.RequestFunction<bent.Json>

  public constructor (
    sso: SingleSignOn,
    tokens: ESITokens,
    opts: ESIOptions = {}
  ) {
    this.sso = sso
    this.#refreshToken = tokens.refreshToken

    if (tokens.accessToken) {
      this.#accessToken = tokens.accessToken
      this.#accessTokenPayload = jwt.decode(tokens.accessToken) as AccessTokenPayload
    }

    this.endpoint = opts.endpoint || 'https://esi.evetech.net/latest'
    this.userAgent = opts.userAgent || `${name}@${version} - nodejs@${process.version} - ${homepage}`

    if (opts.updateRefreshToken) {
      this.updateRefreshToken = opts.updateRefreshToken
    }

    const hostname = parse(this.endpoint).hostname

    this.#getRequest = bent(this.endpoint, 'json', 'GET', {
      Host: hostname,
      'User-Agent': this.userAgent
    })

    this.#postRequest = bent(this.endpoint, 'json', 'POST', {
      Host: hostname,
      'User-Agent': this.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, 200, 201)
  }

  public async makeAuthenticatedGetRequest<T> (
    uri: string,
    query?: { [key: string]: any }
  ): Promise<T> {
    await this.checkAccessToken()

    if (query) {
      uri = `${uri}?${stringify(query)}`
    }

    return this.#getRequest(uri, null, {
      Authorization: `Bearer ${this.#accessToken}`
    }) as unknown as Promise<T>
  }

  public async makeUnauthenticatedGetRequest<T> (
    uri: string,
    query: { [key: string]: any }
  ): Promise<T> {
    if (query) {
      uri = `${uri}?${stringify(query)}`
    }

    return this.#getRequest(uri) as unknown as Promise<T>
  }

  public async makeAuthenticatedPostRequest<T> (
    uri: string,
    payload: { [key: string]: any },
    query?: { [key: string]: any }
  ): Promise<T> {
    await this.checkAccessToken()

    if (query) {
      uri = `${uri}?${stringify(query)}`
    }

    return this.#postRequest(uri, formUrlencoded(payload), {
      Authorization: `Bearer ${this.#accessToken}`
    }) as unknown as Promise<T>
  }

  public async makeUnauthenticatedPostRequest<T> (
    uri: string,
    payload: { [key: string]: any },
    query?: { [key: string]: any }
  ): Promise<T> {
    if (query) {
      uri = `${uri}?${stringify(query)}`
    }

    return this.#postRequest(uri, formUrlencoded(payload)) as unknown as Promise<T>
  }

  private async checkAccessToken (): Promise<void> {
    let refreshAccessToken = false

    if (!this.#accessToken) {
      refreshAccessToken = true
    } else {
      const { exp } = this.#accessTokenPayload
      refreshAccessToken = Math.ceil(new Date().getTime() / 1000) > exp
    }

    if (refreshAccessToken) {
      const reply = await this.sso.getAccessToken(this.#refreshToken, true)
      this.#accessToken = reply.access_token
      this.#accessTokenPayload = jwt.decode(reply.access_token) as AccessTokenPayload

      if (this.#refreshToken !== reply.refresh_token) {
        if (this.updateRefreshToken) {
          await this.updateRefreshToken(this.#refreshToken, reply.refresh_token)
        }

        this.#refreshToken = reply.refresh_token
      }
    }
  }
}
