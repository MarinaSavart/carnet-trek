import type { CookieOptions, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export const SESSION_COOKIE = 'ct_session'

interface SessionPayload {
  sub: string
  /** Version du jeton : si elle ne correspond plus à celle de l'utilisateur, la session est révoquée */
  tv: number
}

// Cookie httpOnly : illisible par le JavaScript de la page, donc hors de portée d'une XSS.
// SameSite=Lax : pas envoyé par les requêtes provenant d'autres sites (défense CSRF,
// en plus de l'en-tête X-Requested-With exigé sur les requêtes qui modifient des données).
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  }
}

export function startSession(res: Response, user: { _id: unknown; tokenVersion: number }) {
  const payload: SessionPayload = { sub: String(user._id), tv: user.tokenVersion }
  const token = jwt.sign(payload, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionDays}d`,
  })
  res.cookie(SESSION_COOKIE, token, cookieOptions())
}

export function endSession(res: Response) {
  // Mêmes attributs qu'à la création, sinon le navigateur ne retrouve pas le cookie
  // (Express 5 ignore maxAge / expires ici)
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}

export function readSession(token: string | undefined): SessionPayload | null {
  if (!token) return null
  try {
    // L'algorithme est imposé : un jeton signé autrement (ou « none ») est refusé
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    if (
      typeof payload === 'object' &&
      typeof payload.sub === 'string' &&
      typeof payload.tv === 'number'
    ) {
      return { sub: payload.sub, tv: payload.tv }
    }
    return null
  } catch {
    return null
  }
}
