import type { RequestHandler } from 'express'
import { isValidObjectId } from 'mongoose'
import { HttpError } from '../lib/errors.js'
import { readSession, SESSION_COOKIE } from '../lib/session.js'
import { User } from '../models/User.js'

export interface AuthUser {
  _id: string
  email: string
  name: string
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Utilisateur connecté, s'il y en a un (renseigné par `loadUser`) */
    user?: AuthUser
  }
}

/** Identifie l'utilisateur à partir du cookie de session, sans rien exiger */
export const loadUser: RequestHandler = async (req, _res, next) => {
  const session = readSession(req.cookies?.[SESSION_COOKIE])
  if (session && isValidObjectId(session.sub)) {
    const user = await User.findById(session.sub).select('email name tokenVersion').lean()
    // Compte supprimé ou sessions révoquées : le cookie est simplement ignoré
    if (user && user.tokenVersion === session.tv) {
      req.user = { _id: user._id.toString(), email: user.email, name: user.name }
    }
  }
  next()
}

/** Réservé aux utilisateurs connectés */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Connexion requise')
  next()
}
