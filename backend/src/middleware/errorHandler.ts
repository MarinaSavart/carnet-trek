import type { ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import { z } from 'zod'
import { config } from '../config.js'
import { HttpError } from '../lib/errors.js'

// Réponse d'erreur uniforme : { error: string, details?: string[] }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'Données invalides',
      details: err.issues.map((issue) => `${issue.path.join('.')} : ${issue.message}`),
    })
    return
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Fichier trop volumineux (max ${config.maxFileSizeMb} Mo)`
        : `Envoi de fichiers refusé : ${err.message}`
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message })
    return
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: 'Données invalides', details: Object.keys(err.errors) })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'Erreur interne du serveur' })
}
