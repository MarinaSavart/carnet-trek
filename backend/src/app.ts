import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config, UPLOADS_URL_PREFIX } from './config.js'
import { loadUser } from './middleware/auth.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.js'
import treksRouter from './routes/treks.js'
import variantesRouter from './routes/variantes.js'

const app = express()

// Derrière le proxy de Vite (ou un reverse proxy en production), l'IP réelle du client
// est dans X-Forwarded-For : nécessaire pour que la limite de tentatives vise la bonne IP.
// Seuls les proxys locaux / réseau privé (Docker) sont crus.
app.set('trust proxy', 'loopback, uniquelocal')

// En-têtes de sécurité standard (nosniff, anti-iframe, CSP…) et masque « X-Powered-By ».
// crossOriginResourcePolicy : le front (autre origine) doit pouvoir afficher les photos.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// Sans authentification, n'importe quel site ouvert dans le navigateur pourrait sinon
// appeler l'API (et supprimer des treks) : seules les origines du front sont autorisées.
// credentials : le cookie de session accompagne les requêtes du front.
app.use(cors({ origin: config.corsOrigins, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// Fichiers envoyés (GPX, photos) : noms uniques et jamais réécrits, donc cache long.
// Ce sont des contenus fournis par les utilisateurs : on interdit toute exécution
// (un GPX est du XML, qui peut embarquer du XHTML et un <script>).
app.use(
  UPLOADS_URL_PREFIX,
  express.static(config.uploadDir, {
    immutable: true,
    maxAge: '30d',
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
      if (filePath.endsWith('.gpx')) {
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', 'attachment; filename="trace.gpx"')
      }
    },
  }),
)

// Le CORS ne suffit pas : un POST multipart est une requête « simple », qu'un autre site
// peut envoyer sans vérification préalable (il ne lira pas la réponse, mais le trek serait
// créé). Exiger un en-tête personnalisé force cette vérification, que le CORS refuse.
export const CSRF_HEADER = 'X-Requested-With'
export const CSRF_HEADER_VALUE = 'carnet-trek'

app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.get(CSRF_HEADER) === CSRF_HEADER_VALUE) return next()
  res.status(403).json({ error: `En-tête ${CSRF_HEADER} manquant` })
})

app.use('/api', loadUser)
app.use('/api/auth', authRouter)
app.use('/api/treks/:trekId/variantes', variantesRouter)
app.use('/api/treks', treksRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route inconnue' })
})

app.use(errorHandler)

export default app
