import type { Trek } from '../types/trek'

export const mockTreks: Trek[] = [
  {
    _id: 'col-gr10',
    name: 'GR10 – Traversée des Pyrénées (partie basque)',
    description: 'Première section, jusqu\'à Etsaut, en plusieurs tronçons.',
    region: 'Pyrénées, Nouvelle-Aquitaine',
    etapes: [
      {
        _id: 'etape-hendaye-olhette',
        order: 1,
        name: 'Hendaye → Olhette',
        distanceKm: 19.5,
        elevationGain: 850,
        elevationLoss: 700,
        durationMin: 360,
        difficulty: 'moyen',
        pois: [
          {
            _id: 'poi-1',
            type: 'point_eau',
            name: 'Fontaine du col',
            location: { type: 'Point', coordinates: [-1.7733, 43.3556] },
          },
          {
            _id: 'poi-2',
            type: 'refuge',
            name: 'Gîte d\'Olhette',
            notes: 'Réservation conseillée en saison',
            location: { type: 'Point', coordinates: [-1.6472, 43.3211] },
          },
        ],
      },
      {
        _id: 'etape-olhette-ainhoa',
        order: 2,
        name: 'Olhette → Ainhoa',
        distanceKm: 17.2,
        elevationGain: 620,
        elevationLoss: 680,
        durationMin: 300,
        difficulty: 'facile',
        pois: [
          {
            _id: 'poi-3',
            type: 'ravitaillement',
            name: 'Épicerie du village',
            location: { type: 'Point', coordinates: [-1.5978, 43.2867] },
          },
        ],
      },
    ],
  },
  {
    _id: 'col-islande',
    name: 'Islande – trek autonome',
    description: 'Une semaine en autonomie complète dans les Hautes Terres.',
    region: 'Hautes Terres, Islande',
    etapes: [
      {
        _id: 'etape-laugavegur-fimm',
        order: 2,
        name: 'Étape 2 – Laugavegur & Fimmvörðuháls',
        distanceKm: 14.8,
        elevationGain: 330,
        elevationLoss: 800,
        durationMin: 337,
        difficulty: 'difficile',
        pois: [
          {
            _id: 'poi-4',
            type: 'refuge',
            name: 'Höskuldsskáli',
            notes: 'Petit refuge, cercles de pierre pour les tentes',
            location: { type: 'Point', coordinates: [-19.2103, 63.8556] },
          },
          {
            _id: 'poi-5',
            type: 'camping',
            name: 'Camping Álftavatn',
            location: { type: 'Point', coordinates: [-19.1611, 63.7833] },
          },
        ],
      },
    ],
  },
]