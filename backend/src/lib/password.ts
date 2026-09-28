import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// scrypt (intégré à Node) : fonction de hachage lente et gourmande en mémoire, conçue
// pour les mots de passe. Paramètres recommandés par l'OWASP (N=2^17, r=8, p=1).
const PARAMS: ScryptOptions = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
const KEY_LENGTH = 64

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, PARAMS, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

/** Format stocké : scrypt$<sel en base64>$<hash en base64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltB64, hashB64] = stored.split('$')
  if (algorithm !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'))
  // Comparaison à temps constant : ne révèle pas combien d'octets correspondent
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Hash factice utilisé quand l'email est inconnu : la réponse prend le même temps
// que pour un vrai compte, on ne peut pas deviner quels emails sont inscrits.
let dummyHash: Promise<string> | null = null
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'))
  return dummyHash
}
