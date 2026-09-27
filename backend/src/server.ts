import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app.js'

const PORT = process.env.PORT || 3000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/carnet-trek'

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connecté à MongoDB')
    app.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`))
  })
  .catch((err) => {
    console.error('Erreur de connexion MongoDB :', err)
    process.exit(1)
  })