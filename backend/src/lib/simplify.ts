// Simplification de tracé (Ramer-Douglas-Peucker) : garde la forme d'une trace en ne
// conservant que les points qui s'écartent de plus de `tolerance` de la ligne simplifiée.
// Sert à la carte d'accueil, où des milliers de points par étape seraient inutiles.

type Coord = [number, number]

// Distance (au carré) d'un point au segment [a, b], en degrés. Les longitudes sont
// ramenées à l'échelle des latitudes (cos φ) pour ne pas sur-simplifier vers les pôles.
function segmentDistanceSq(p: Coord, a: Coord, b: Coord, lonScale: number): number {
  const ax = a[0] * lonScale
  const bx = b[0] * lonScale
  const px = p[0] * lonScale
  const dx = bx - ax
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (p[1] - a[1]) * dy) / lengthSq))
    : 0
  const x = ax + t * dx - px
  const y = a[1] + t * dy - p[1]
  return x * x + y * y
}

/** `tolerance` en degrés de latitude (0.0002 ≈ 22 m) ; coordonnées arrondies à ~1 m */
export function simplifyLine(coordinates: Coord[], tolerance: number): Coord[] {
  if (coordinates.length <= 2) return coordinates.map(roundCoord)

  const lonScale = Math.cos((coordinates[0]![1] * Math.PI) / 180)
  const toleranceSq = tolerance * tolerance
  const keep = new Uint8Array(coordinates.length)
  keep[0] = 1
  keep[coordinates.length - 1] = 1

  // Pile plutôt que récursion : une trace peut compter des dizaines de milliers de points
  const stack: [number, number][] = [[0, coordinates.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    let maxDistance = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const distance = segmentDistanceSq(
        coordinates[i]!,
        coordinates[first]!,
        coordinates[last]!,
        lonScale,
      )
      if (distance > maxDistance) {
        maxDistance = distance
        index = i
      }
    }
    if (index !== -1 && maxDistance > toleranceSq) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  return coordinates.filter((_, i) => keep[i]).map(roundCoord)
}

function roundCoord([lon, lat]: Coord): Coord {
  return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]
}
