import { HttpError } from '../lib/errors.js'
import { getDummyHash, hashPassword, verifyPassword } from '../lib/password.js'
import { User } from '../models/User.js'

// Calculé dès le chargement : sinon la toute première connexion avec un email inconnu
// serait plus lente que les autres (et trahirait que l'email n'existe pas)
void getDummyHash()

export async function createUser(input: { email: string; name: string; password: string }) {
  if (await User.exists({ email: input.email })) {
    throw new HttpError(409, 'Un compte existe déjà avec cet email')
  }
  return User.create({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
  })
}

/** Renvoie l'utilisateur si les identifiants sont bons, sinon une erreur volontairement vague */
export async function authenticate(email: string, password: string) {
  const user = await User.findOne({ email })
  // Toujours vérifier un hash, même pour un email inconnu : même temps de réponse
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()))
  if (!user || !valid) throw new HttpError(401, 'Email ou mot de passe incorrect')
  return user
}
