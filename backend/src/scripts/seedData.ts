import type { TrekInput } from '../validation/trek.js'

// Treks d'exemple. `folder` pointe vers seed/<dossier> : le premier .gpx trouvé et les
// images de photos/ y sont chargés comme s'ils avaient été envoyés par le formulaire.
// GPX : Islande = traces réelles ; GR10 = tracé OpenStreetMap avec altitudes EU-DEM ; autres
// treks = reconstitués à partir des points de passage réels (villages, refuges, cols), donc
// approximatifs entre deux points. Photos : Wikimedia Commons, crédits dans seed/CREDITS.md.
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
    name: 'GR10 – Traversée des Pyrénées',
    region: "Pyrénées, de l'Atlantique à la Méditerranée",
    description:
      "La grande traversée des Pyrénées françaises, d'Hendaye à Banyuls-sur-Mer : environ 920 km en 51 étapes. Tracé OpenStreetMap, altitudes EU-DEM.",
    etapes: [
      {
        name: 'Hendaye → Olhette',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/01-hendaye-olhette',
      },
      {
        name: 'Olhette → Ainhoa',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/02-olhette-ainhoa',
      },
      {
        name: 'Ainhoa → Bidarray',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/03-ainhoa-bidarray',
      },
      {
        name: 'Bidarray → Saint-Étienne-de-Baïgorry',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/04-bidarray-saint-etienne-de-baigorry',
      },
      {
        name: 'Saint-Étienne-de-Baïgorry → Saint-Jean-Pied-de-Port',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/05-saint-etienne-de-baigorry-saint-jean-pied-de-port',
      },
      {
        name: 'Saint-Jean-Pied-de-Port → Estérençuby',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/06-saint-jean-pied-de-port-esterencuby',
      },
      {
        name: "Estérençuby → Chalets d'Iraty",
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/07-esterencuby-chalets-d-iraty',
      },
      {
        name: "Chalets d'Iraty → Logibar",
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/08-chalets-d-iraty-logibar',
      },
      {
        name: 'Logibar → Sainte-Engrâce',
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/09-logibar-sainte-engrace',
      },
      {
        name: 'Sainte-Engrâce → Arette-la-Pierre-Saint-Martin',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/10-sainte-engrace-arette-la-pierre-saint-martin',
      },
      {
        name: 'Arette-la-Pierre-Saint-Martin → Lescun',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/11-arette-la-pierre-saint-martin-lescun',
      },
      {
        name: 'Lescun → Etsaut',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/12-lescun-etsaut',
      },
      {
        name: "Etsaut → Refuge d'Ayous",
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/13-etsaut-refuge-d-ayous',
      },
      {
        name: "Refuge d'Ayous → Gabas",
        description: '',
        difficulty: 'facile',
        folder: 'gr10/14-refuge-d-ayous-gabas',
      },
      {
        name: 'Gabas → Gourette',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/15-gabas-gourette',
      },
      {
        name: 'Gourette → Arrens-Marsous',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/16-gourette-arrens-marsous',
      },
      {
        name: 'Arrens-Marsous → Cauterets',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/17-arrens-marsous-cauterets',
      },
      {
        name: 'Cauterets → Refuge des Oulettes de Gaube',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/18-cauterets-refuge-des-oulettes-de-gaube',
      },
      {
        name: 'Refuge des Oulettes de Gaube → Gavarnie',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/19-refuge-des-oulettes-de-gaube-gavarnie',
      },
      {
        name: 'Gavarnie → Luz-Saint-Sauveur',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/20-gavarnie-luz-saint-sauveur',
      },
      {
        name: 'Luz-Saint-Sauveur → Barèges',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/21-luz-saint-sauveur-bareges',
      },
      {
        name: "Barèges → Chalet-Hôtel de l'Oule",
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/22-bareges-chalet-hotel-de-l-oule',
      },
      {
        name: "Chalet-Hôtel de l'Oule → Vielle-Aure",
        description: '',
        difficulty: 'facile',
        folder: 'gr10/23-chalet-hotel-de-l-oule-vielle-aure',
      },
      {
        name: 'Vielle-Aure → Germ',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/24-vielle-aure-germ',
      },
      {
        name: "Germ → Granges d'Astau",
        description: '',
        difficulty: 'facile',
        folder: 'gr10/25-germ-granges-d-astau',
      },
      {
        name: "Granges d'Astau → Bagnères-de-Luchon",
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/26-granges-d-astau-bagneres-de-luchon',
      },
      {
        name: 'Bagnères-de-Luchon → Fos',
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/27-bagneres-de-luchon-fos',
      },
      {
        name: "Fos → Refuge de l'Étang d'Araing",
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/28-fos-refuge-de-l-etang-d-araing',
      },
      {
        name: "Refuge de l'Étang d'Araing → Eylie",
        description: '',
        difficulty: 'facile',
        folder: 'gr10/29-refuge-de-l-etang-d-araing-eylie',
      },
      {
        name: 'Eylie → Cabane des Espugues',
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/30-eylie-cabane-des-espugues',
      },
      {
        name: 'Cabane des Espugues → Esbintz',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/31-cabane-des-espugues-esbintz',
      },
      {
        name: "Esbintz → Rouze d'Ustou",
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/32-esbintz-rouze-d-ustou',
      },
      {
        name: "Rouze d'Ustou → Aulus-les-Bains",
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/33-rouze-d-ustou-aulus-les-bains',
      },
      {
        name: 'Aulus-les-Bains → Marc',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/34-aulus-les-bains-marc',
      },
      {
        name: 'Marc → Goulier',
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/35-marc-goulier',
      },
      {
        name: 'Goulier → Siguer',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/36-goulier-siguer',
      },
      {
        name: 'Siguer → Cabane des Ludines',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/37-siguer-cabane-des-ludines',
      },
      {
        name: 'Cabane des Ludines → Refuge du Rulhe',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/38-cabane-des-ludines-refuge-du-rulhe',
      },
      {
        name: 'Refuge du Rulhe → Mérens-les-Vals',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/39-refuge-du-rulhe-merens-les-vals',
      },
      {
        name: 'Mérens-les-Vals → Refuge des Bésines',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/40-merens-les-vals-refuge-des-besines',
      },
      {
        name: 'Refuge des Bésines → Refuge des Bouillouses',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/41-refuge-des-besines-refuge-des-bouillouses',
      },
      {
        name: 'Refuge des Bouillouses → Planès',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/42-refuge-des-bouillouses-planes',
      },
      {
        name: 'Planès → Mantet',
        description: '',
        difficulty: 'tres_difficile',
        folder: 'gr10/43-planes-mantet',
      },
      {
        name: 'Mantet → Refuge de Mariailles',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/44-mantet-refuge-de-mariailles',
      },
      {
        name: 'Refuge de Mariailles → Refuge des Cortalets',
        description: '',
        difficulty: 'difficile',
        folder: 'gr10/45-refuge-de-mariailles-refuge-des-cortalets',
      },
      {
        name: 'Refuge des Cortalets → Batère',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/46-refuge-des-cortalets-batere',
      },
      {
        name: 'Batère → Moulin de la Palette',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/47-batere-moulin-de-la-palette',
      },
      {
        name: 'Moulin de la Palette → Las Illas',
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/48-moulin-de-la-palette-las-illas',
      },
      {
        name: 'Las Illas → Le Perthus',
        description: '',
        difficulty: 'facile',
        folder: 'gr10/49-las-illas-le-perthus',
      },
      {
        name: "Le Perthus → Col de l'Ouillat",
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/50-le-perthus-col-de-l-ouillat',
      },
      {
        name: "Col de l'Ouillat → Banyuls-sur-Mer",
        description: '',
        difficulty: 'moyen',
        folder: 'gr10/51-col-de-l-ouillat-banyuls-sur-mer',
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
