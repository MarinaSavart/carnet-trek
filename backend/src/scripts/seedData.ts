import type { TrekInput } from '../validation/trek.js'

// Treks d'exemple. `folder` pointe vers seed/<dossier> : le premier .gpx trouvé et les
// images de photos/ y sont chargés comme s'ils avaient été envoyés par le formulaire.
export interface SeedTrek extends Omit<TrekInput, 'etapes'> {
  etapes: (TrekInput['etapes'][number] & { folder?: string })[]
}

export const seedTreks: SeedTrek[] = [
  {
    name: 'Islande – Laugavegur',
    region: 'Hautes Terres, Islande',
    description: 'Une semaine en autonomie complète dans les Hautes Terres.',
    etapes: [
      {
        name: 'Landmannalaugar → Hrafntinnusker',
        description: '',
        difficulty: 'difficile',
        folder: 'islande/1-landmannalaugar-hrafntinnusker',
      },
      {
        name: 'Hrafntinnusker → Álftavatn',
        description: '',
        difficulty: 'difficile',
        folder: 'islande/2-hrafntinnusker-alftavatn',
      },
      {
        name: 'Álftavatn → Emstrur',
        description: '',
        difficulty: 'moyen',
        folder: 'islande/3-alftavatn-emstrur',
      },
      {
        name: 'Emstrur → Þórsmörk',
        description: '',
        difficulty: 'moyen',
        folder: 'islande/4-emstrur-thorsmork',
      },
    ],
  },
  {
    name: 'GR10 – Traversée des Pyrénées (partie basque)',
    region: 'Pyrénées, Nouvelle-Aquitaine',
    description: "Première section, jusqu'à Etsaut, en plusieurs tronçons.",
    // Pas de GPX : stats saisies à la main
    etapes: [
      {
        name: 'Hendaye → Olhette',
        description: '',
        difficulty: 'moyen',
        distanceKm: 19.5,
        elevationGain: 850,
        elevationLoss: 700,
        durationMin: 360,
      },
      {
        name: 'Olhette → Ainhoa',
        description: '',
        difficulty: 'facile',
        distanceKm: 17.2,
        elevationGain: 620,
        elevationLoss: 680,
        durationMin: 300,
      },
    ],
  },
]
