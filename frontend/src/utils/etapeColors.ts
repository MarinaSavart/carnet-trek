// Une couleur par étape, partagée entre la carte et la liste pour les relier visuellement.
// Tons saturés, lisibles sur le fond de carte clair et avec un texte blanc par-dessus.
const ETAPE_COLORS = ['#1f6fd1', '#c0392b', '#7b5cd6', '#6d4c41', '#0e8a7d', '#d35400']

export function getEtapeColor(index: number): string {
  return ETAPE_COLORS[index % ETAPE_COLORS.length]!
}
