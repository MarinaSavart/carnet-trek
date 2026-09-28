import express from 'express'
import cors from 'cors'
import treksRouter from './routes/treks.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api/treks', treksRouter)

export default app
