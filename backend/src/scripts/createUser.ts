// Crée un compte depuis le terminal (utile quand ALLOW_REGISTRATION=false).
//   npm run create-user -- <email> "<nom>"
// Le mot de passe est demandé de façon interactive (jamais passé en argument :
// il finirait dans l'historique du shell).
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import mongoose from 'mongoose'
import { config } from '../config.js'
import { createUser } from '../services/authService.js'
import { registerSchema } from '../validation/auth.js'

async function main() {
  const [email, name] = process.argv.slice(2)
  if (!email || !name) {
    console.error('Usage : npm run create-user -- <email> "<nom>"')
    process.exitCode = 1
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const password = await rl.question('Mot de passe (10 caractères min.) : ')
  rl.close()

  const input = registerSchema.parse({ email, name, password })
  await mongoose.connect(config.mongoUri)
  const user = await createUser(input)
  console.log(`Compte créé : ${user.email}`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
