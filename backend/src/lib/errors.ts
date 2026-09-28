/** Erreur métier renvoyée telle quelle au client, avec son code HTTP */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
