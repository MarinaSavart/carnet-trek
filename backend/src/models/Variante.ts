import { model, Schema, type InferSchemaType } from 'mongoose'

// Découpage d'un trek proposé par un utilisateur, visible par tous : des groupes d'étapes
// consécutives, chaque groupe devenant une étape fusionnée. Seules les références aux
// étapes sont stockées : le trek d'origine n'est jamais modifié, et ses corrections
// profitent aux variantes.
const varianteSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trek: { type: Schema.Types.ObjectId, ref: 'Trek', required: true, index: true },
    groups: { type: [[Schema.Types.ObjectId]], required: true },
  },
  { timestamps: true, versionKey: false },
)

export type VarianteDocument = InferSchemaType<typeof varianteSchema>

export const Variante = model('Variante', varianteSchema)
