import { model, Schema, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    // Incrémenté pour invalider toutes les sessions en cours (ex. changement de mot de passe)
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    // Le hash ne doit jamais sortir de l'API, même par erreur
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash
        delete ret.tokenVersion
        return ret
      },
    },
  },
)

export type UserDocument = InferSchemaType<typeof userSchema>

export const User = model('User', userSchema)

/** Ce que l'API expose d'un utilisateur */
export function publicUser(user: { _id: unknown; email: string; name: string }) {
  return { _id: String(user._id), email: user.email, name: user.name }
}
