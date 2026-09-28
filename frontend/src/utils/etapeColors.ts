// Une couleur par étape, partagée entre la carte, la liste et le profil d'altitude.
// Ordre fixe, validé (daltonisme, luminosité, contraste) sur le fond sombre de l'appli
// comme sur le fond de carte clair : ne pas réordonner sans revalider.
const ETAPE_COLORS = ['#2a78d6', '#d95926', '#8a6ee8', '#199e70', '#c98500', '#d55181']

export function getEtapeColor(index: number): string {
  return ETAPE_COLORS[index % ETAPE_COLORS.length]!
}
