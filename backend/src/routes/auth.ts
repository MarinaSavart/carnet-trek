import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { config } from '../config.js'
import { HttpError } from '../lib/errors.js'
import { endSession, startSession } from '../lib/session.js'
import { publicUser } from '../models/User.js'
import { authenticate, createUser } from '../services/authService.js'
import { loginSchema, registerSchema } from '../validation/auth.js'

const router = Router()

// Anti-bruteforce : 10 tentatives par IP et par quart d'heure (seuls les échecs comptent)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessaie dans quelques minutes' },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de créations de compte, réessaie plus tard' },
})

router.get('/me', (req, res) => {
  // 200 dans tous les cas : « personne n'est connecté » n'est pas une erreur
  res.json({ user: req.user ?? null })
})

router.post('/register', registerLimiter, async (req, res) => {
  if (!config.allowRegistration) throw new HttpError(403, 'Les inscriptions sont fermées')
  const input = registerSchema.parse(req.body)
  const user = await createUser(input)
  startSession(res, user)
  res.status(201).json({ user: publicUser(user) })
})

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const user = await authenticate(email, password)
  startSession(res, user)
  res.json({ user: publicUser(user) })
})

router.post('/logout', (_req, res) => {
  endSession(res)
  res.status(204).send()
})

export default router
