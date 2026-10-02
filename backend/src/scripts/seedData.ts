import type { TrekInput } from '../validation/trek.js'

// Treks d'exemple. `folder` pointe vers seed/<dossier> : le premier .gpx trouvé et les
// images de photos/ y sont chargés comme s'ils avaient été envoyés par le formulaire.
// Hors Islande, les GPX sont reconstitués à partir des points de passage réels (villages,
// refuges, cols) : le tracé entre deux points est approximatif.
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
  {
    name: 'Tour du Mont-Blanc (Les Houches → Courmayeur)',
    region: 'Alpes, Haute-Savoie / Vallée d’Aoste',
    description:
      'Première moitié du TMB, de la vallée de Chamonix au versant italien par le col de la Seigne.',
    etapes: [
      {
        name: 'Les Houches → Les Contamines',
        description: '',
        difficulty: 'moyen',
        folder: 'tour-du-mont-blanc/1-les-houches-contamines',
      },
      {
        name: 'Les Contamines → Les Chapieux',
        description: 'Montée au col du Bonhomme puis à la Croix du Bonhomme, la plus longue étape.',
        difficulty: 'difficile',
        folder: 'tour-du-mont-blanc/2-contamines-chapieux',
      },
      {
        name: 'Les Chapieux → Rifugio Elisabetta',
        description: '',
        difficulty: 'difficile',
        folder: 'tour-du-mont-blanc/3-chapieux-elisabetta',
      },
      {
        name: 'Rifugio Elisabetta → Courmayeur',
        description: 'Balcon face aux Grandes Jorasses, puis longue descente sur Courmayeur.',
        difficulty: 'moyen',
        folder: 'tour-du-mont-blanc/4-elisabetta-courmayeur',
      },
    ],
  },
  {
    name: 'GR20 Nord – Calenzana → Ascu',
    region: 'Haute-Corse',
    description: 'Les trois premières étapes du GR20, sauvages et très minérales.',
    etapes: [
      {
        name: 'Calenzana → Refuge d’Ortu di u Piobbu',
        description: '1 300 m de montée d’une traite, peu d’ombre : partir tôt.',
        difficulty: 'tres_difficile',
        folder: 'gr20-nord/1-calenzana-ortu',
      },
      {
        name: 'Ortu di u Piobbu → Refuge de Carrozzu',
        description: '',
        difficulty: 'difficile',
        folder: 'gr20-nord/2-ortu-carrozzu',
      },
      {
        name: 'Carrozzu → Ascu Stagnu',
        description:
          'Passerelle de la Spasimata puis dalles rocheuses jusqu’à la Bocca di l’Innominata.',
        difficulty: 'tres_difficile',
        folder: 'gr20-nord/3-carrozzu-ascu',
      },
    ],
  },
  {
    name: 'Alta Via 1 des Dolomites',
    region: 'Dolomites, Italie',
    description: 'De refuge en refuge, du lac de Braies au Nuvolau.',
    etapes: [
      {
        name: 'Lago di Braies → Pederü',
        description: '',
        difficulty: 'moyen',
        folder: 'alta-via-1/1-braies-pederu',
      },
      {
        name: 'Pederü → Rifugio Lagazuoi',
        description: 'Plateau de Fanes puis montée raide par la Forcella del Lago.',
        difficulty: 'difficile',
        folder: 'alta-via-1/2-pederu-lagazuoi',
      },
      {
        name: 'Lagazuoi → Rifugio Nuvolau',
        description: '',
        difficulty: 'moyen',
        folder: 'alta-via-1/3-lagazuoi-nuvolau',
      },
    ],
  },
  {
    name: 'Chemin de Stevenson (GR70)',
    region: 'Haute-Loire',
    description: 'Les premiers jours du chemin, du Puy-en-Velay aux portes de la Lozère.',
    etapes: [
      {
        name: 'Le Puy-en-Velay → Le Monastier-sur-Gazeille',
        description: '',
        difficulty: 'facile',
        folder: 'chemin-de-stevenson/1-le-puy-monastier',
      },
      {
        name: 'Le Monastier → Le Bouchet-Saint-Nicolas',
        description: 'Descente dans les gorges de la Loire à Goudet, puis plateau volcanique.',
        difficulty: 'moyen',
        folder: 'chemin-de-stevenson/2-monastier-bouchet',
      },
      {
        name: 'Le Bouchet-Saint-Nicolas → Pradelles',
        description: '',
        difficulty: 'facile',
        folder: 'chemin-de-stevenson/3-bouchet-pradelles',
      },
    ],
  },
  {
    name: 'Traversée des Calanques',
    region: 'Bouches-du-Rhône',
    description: 'De Callelongue à Cassis par les calanques de Sormiou, Morgiou et En-Vau.',
    etapes: [
      {
        name: 'Callelongue → Morgiou',
        description: '',
        difficulty: 'moyen',
        folder: 'calanques/1-callelongue-morgiou',
      },
      {
        name: 'Morgiou → Cassis',
        description:
          'Massif fermé par risque d’incendie certains jours d’été : vérifier avant de partir.',
        difficulty: 'moyen',
        folder: 'calanques/2-morgiou-cassis',
      },
    ],
  },
  {
    name: 'GR34 – Côte de Granit Rose',
    region: 'Côtes-d’Armor, Bretagne',
    description: 'Sentier des douaniers entre Perros-Guirec et Trébeurden.',
    etapes: [
      {
        name: 'Perros-Guirec → Trégastel',
        description: 'Le chaos de granit rose de Ploumanac’h.',
        difficulty: 'facile',
        folder: 'gr34-granit-rose/1-perros-tregastel',
      },
      {
        name: 'Trégastel → Trébeurden',
        description: '',
        difficulty: 'facile',
        folder: 'gr34-granit-rose/2-tregastel-trebeurden',
      },
    ],
  },
]
