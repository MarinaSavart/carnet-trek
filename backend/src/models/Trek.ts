import { model, Schema } from 'mongoose'

const trekSchema = new Schema(
  {
    name: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    elevationGain: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
)

export const Trek = model('Trek', trekSchema)
