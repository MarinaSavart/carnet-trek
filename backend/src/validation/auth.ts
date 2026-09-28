import { z } from 'zod'

const email = z.string().trim().toLowerCase().pipe(z.email('Email invalide').max(254))

// Longueur minimale plutôt que règles de composition (recommandation NIST / OWASP).
// Maximum : borne le coût du hachage.
const password = z
  .string()
  .min(10, 'Le mot de passe doit faire au moins 10 caractères')
  .max(200, 'Mot de passe trop long')

export const registerSchema = z.object({
  email,
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(80),
  password,
})

export const loginSchema = z.object({
  email,
  // Pas de règle de longueur ici : ne pas révéler la politique à la connexion
  password: z.string().min(1).max(200),
})
