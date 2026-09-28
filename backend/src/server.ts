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
    // Piège fréquent : l'URI Docker (hôte « mongo ») utilisée pour un lancement local
    if (String(err).includes('ENOTFOUND mongo')) {
      console.error(
        "\n→ L'hôte « mongo » n'existe que dans le réseau Docker. En local (npm run dev)," +
          '\n  utilise MONGO_URI=mongodb://127.0.0.1:27017/carnet-trek dans backend/.env.\n',
      )
    }
    process.exit(1)
  })
