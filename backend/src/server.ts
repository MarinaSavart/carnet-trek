import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app.js'
import { config } from './config.js'

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connecté à MongoDB')
    app.listen(config.port, () => console.log(`Serveur sur le port ${config.port}`))
  })
  .catch((err) => {
    console.error('Erreur de connexion MongoDB :', err)
    process.exit(1)
  })
