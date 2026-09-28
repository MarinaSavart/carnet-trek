import cors from 'cors'
import express from 'express'
import { config, UPLOADS_URL_PREFIX } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import treksRouter from './routes/treks.js'

const app = express()

app.use(
  cors({
    origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map((o) => o.trim()),
  }),
)
app.use(express.json())

// Fichiers envoyés (GPX, photos) : noms uniques et jamais réécrits, donc cache long
app.use(
  UPLOADS_URL_PREFIX,
  express.static(config.uploadDir, { immutable: true, maxAge: '30d', index: false }),
)

app.use('/api/treks', treksRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route inconnue' })
})

app.use(errorHandler)

export default app
