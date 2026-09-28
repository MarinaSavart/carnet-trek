import { model, Schema, type InferSchemaType } from 'mongoose'

export const POI_TYPES = [
  'refuge',
  'camping',
  'point_eau',
  'sommet',
  'ravitaillement',
  'autre',
] as const
export type PoiType = (typeof POI_TYPES)[number]

export const DIFFICULTIES = ['facile', 'moyen', 'difficile', 'tres_difficile'] as const

// Convention GeoJSON : [longitude, latitude]
const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
)

const lineStringSchema = new Schema(
  {
    type: { type: String, enum: ['LineString'], required: true },
    coordinates: { type: [[Number]], required: true },
  },
  { _id: false },
)

const elevationPointSchema = new Schema(
  {
    distanceKm: { type: Number, required: true },
    elevation: { type: Number, required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
)

const poiSchema = new Schema({
  type: { type: String, enum: POI_TYPES, required: true },
  name: { type: String, required: true },
  notes: String,
  location: { type: pointSchema, required: true },
})

// Fichier envoyé : `url` est publique (servie sous /uploads), `originalName` sert à l'affichage
const fileSchema = new Schema({
  url: { type: String, required: true },
  originalName: { type: String, required: true },
})

const etapeSchema = new Schema({
  order: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  difficulty: { type: String, enum: DIFFICULTIES, required: true },
  distanceKm: { type: Number, required: true, min: 0 },
  elevationGain: { type: Number, default: 0, min: 0 },
  elevationLoss: { type: Number, default: 0, min: 0 },
  durationMin: { type: Number, required: true, min: 0 },
  gpxFile: fileSchema,
  gpxTrack: lineStringSchema,
  elevationProfile: { type: [elevationPointSchema], default: undefined },
  pois: { type: [poiSchema], default: [] },
  photos: { type: [fileSchema], default: [] },
})

const trekSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    region: { type: String, default: '' },
    description: { type: String, default: '' },
    etapes: { type: [etapeSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
)

export type TrekDocument = InferSchemaType<typeof trekSchema>

export const Trek = model('Trek', trekSchema)
