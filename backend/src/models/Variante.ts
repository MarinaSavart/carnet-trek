import { model, Schema, type InferSchemaType } from 'mongoose'

// Découpage d'un trek proposé par un utilisateur, visible par tous : des groupes d'étapes
// consécutives (chaque groupe devient une étape fusionnée), plus d'éventuelles nuits au
// milieu d'une étape (`cuts`). Seules les références aux étapes sont stockées : le trek
// d'origine n'est jamais modifié, et ses corrections profitent aux variantes.
const cutSchema = new Schema(
  {
    etape: { type: Schema.Types.ObjectId, required: true },
    /** Position de la nuit, en km depuis le départ de l'étape (mesurée sur sa trace) */
    km: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const varianteSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trek: { type: Schema.Types.ObjectId, ref: 'Trek', required: true, index: true },
    groups: { type: [[Schema.Types.ObjectId]], required: true },
    cuts: { type: [cutSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
)

export type VarianteDocument = InferSchemaType<typeof varianteSchema>

export const Variante = model('Variante', varianteSchema)
