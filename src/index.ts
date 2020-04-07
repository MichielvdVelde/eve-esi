'use strict'

import { stringify } from 'querystring'
import { parse } from 'url'

import bent from 'bent'
import SingleSignOn from 'eve-sso'
import jwt from 'jsonwebtoken'
import formUrlencoded from 'form-urlencoded'

const { name, version, homepage } = require('../package')

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

  public async makeGetRequest<T> (
    uri: string,
    query?: { [key: string]: any }
  ): Promise<T> {
    await this.checkAccessToken()

    if (query) {
      uri = `${uri}?${stringify(query)}`
    }

    return this.#getRequest(uri, null, {
      Authorization: `Bearer ${this.#accessToken}`
    }) as unknown as T
  }

  public async makePostRequest<T> (
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
    }) as unknown as T
  }

  private async checkAccessToken (): Promise<void> {
    let refreshAccessToken = false

    if (!this.#accessToken) {
      refreshAccessToken = true
    } else {
      const { exp } = jwt.decode(this.#accessToken) as { exp: number }
      refreshAccessToken = new Date().getTime() > exp
    }

    if (refreshAccessToken) {
      const reply = await this.sso.getAccessToken(this.#refreshToken, true)
      this.#accessToken = reply.access_token

      if (this.#refreshToken !== reply.refresh_token) {
        if (this.updateRefreshToken) {
          await this.updateRefreshToken(this.#refreshToken, reply.refresh_token)
        }

        this.#refreshToken = reply.refresh_token
      }
    }
  }
}
