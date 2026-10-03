// Recherche tolérante : sans accents ni majuscules, ponctuation ignorée, chaque mot
// cherché séparément (« mont blanc tour » trouve « Tour du Mont-Blanc »)

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Vrai si chaque mot de la recherche apparaît dans l'un des champs ; recherche vide : tout passe */
export function matchesSearch(fields: string[], query: string): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const haystack = normalizeSearch(fields.join(' '))
  return words.every((word) => haystack.includes(word))
}
