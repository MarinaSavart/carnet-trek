export type POIType = 'refuge' | 'camping' | 'point_eau' | 'sommet' | 'ravitaillement' | 'autre'

export type Difficulty = 'facile' | 'moyen' | 'difficile' | 'tres_difficile'

// Convention GeoJSON : [longitude, latitude], PAS [lat, lng] —
// c'est l'inverse de ce qu'on a l'habitude de voir (Google Maps fait lat/lng),
// piège classique qui casse silencieusement l'affichage sur la carte plus tard.
export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number]
}

export interface GeoJSONLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface POI {
  _id: string
  type: POIType
  name: string
  notes?: string
  location: GeoJSONPoint
}

export interface Etape {
  _id: string
  order: number
  name: string
  distanceKm: number
  elevationGain: number
  elevationLoss: number
  durationMin: number
  difficulty: Difficulty
  gpxTrack?: GeoJSONLineString
  pois: POI[]
}

export interface Trek {
  _id: string
  name: string
  description: string
  region: string
  etapes: Etape[]
}
