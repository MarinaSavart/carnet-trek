<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ElevationPoint } from '../types/trek'

export interface ProfileSegment {
  id: string
  label: string
  color: string
  points: ElevationPoint[]
}

export interface ProfileHover {
  segmentId: string
  coordinates: [number, number]
}

const props = defineProps<{
  segments: ProfileSegment[]
  /** Segment à mettre en avant (étape survolée ailleurs sur la page) */
  highlightedId?: string | null
  /** Position survolée ailleurs (sur la carte) : le curseur du profil s'y cale */
  cursor?: ProfileHover | null
}>()

const emit = defineEmits<{
  hover: [value: ProfileHover | null]
}>()

const HEIGHT = 160
const MARGIN = { top: 12, right: 12, bottom: 24, left: 48 }

const container = ref<HTMLDivElement | null>(null)
const width = ref(0)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!container.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    width.value = entry?.contentRect.width ?? 0
  })
  resizeObserver.observe(container.value)
})
onUnmounted(() => resizeObserver?.disconnect())

// Les segments sont mis bout à bout : la distance devient cumulée sur tout le trek
const flatPoints = computed(() => {
  let offset = 0
  return props.segments.flatMap((segment) => {
    const points = segment.points.map((p) => ({
      ...p,
      x: offset + p.distanceKm,
      segment,
    }))
    offset += segment.points[segment.points.length - 1]?.distanceKm ?? 0
    return points
  })
})

const totalKm = computed(() => flatPoints.value[flatPoints.value.length - 1]?.x ?? 0)

const elevationRange = computed(() => {
  const elevations = flatPoints.value.map((p) => p.elevation)
  return { min: Math.min(...elevations), max: Math.max(...elevations) }
})

// Pas « ronds » pour les graduations : au plus ~4 lignes horizontales, ~6 verticales
function niceStep(span: number, maxTicks: number, steps: number[]): number {
  return steps.find((s) => span / s <= maxTicks) ?? steps[steps.length - 1]!
}

const yScale = computed(() => {
  const { min, max } = elevationRange.value
  const step = niceStep(max - min, 4, [10, 20, 25, 50, 100, 200, 250, 500, 1000])
  const low = Math.floor(min / step) * step
  const high = Math.max(Math.ceil(max / step) * step, low + step)
  const ticks: number[] = []
  for (let v = low; v <= high; v += step) ticks.push(v)
  return { low, high, ticks }
})

const xTicks = computed(() => {
  const step = niceStep(totalKm.value, 6, [0.5, 1, 2, 5, 10, 20, 50, 100])
  const ticks: number[] = []
  for (let v = 0; v <= totalKm.value; v += step) ticks.push(v)
  return ticks
})

const plot = computed(() => ({
  left: MARGIN.left,
  right: Math.max(width.value - MARGIN.right, MARGIN.left + 1),
  top: MARGIN.top,
  bottom: HEIGHT - MARGIN.bottom,
}))

function xPos(km: number): number {
  const { left, right } = plot.value
  return left + (km / (totalKm.value || 1)) * (right - left)
}

function yPos(elevation: number): number {
  const { top, bottom } = plot.value
  const { low, high } = yScale.value
  return bottom - ((elevation - low) / (high - low)) * (bottom - top)
}

const paths = computed(() => {
  let offset = 0
  return props.segments.map((segment) => {
    const coords = segment.points.map(
      (p) => `${xPos(offset + p.distanceKm).toFixed(1)},${yPos(p.elevation).toFixed(1)}`,
    )
    const first = segment.points[0]
    const last = segment.points[segment.points.length - 1]
    const x0 = xPos(offset + (first?.distanceKm ?? 0)).toFixed(1)
    const x1 = xPos(offset + (last?.distanceKm ?? 0)).toFixed(1)
    offset += last?.distanceKm ?? 0

    return {
      id: segment.id,
      color: segment.color,
      line: `M${coords.join('L')}`,
      area: `M${x0},${plot.value.bottom}L${coords.join('L')}L${x1},${plot.value.bottom}Z`,
    }
  })
})

// --- Survol : le curseur se cale sur le point le plus proche en distance ---

const hoveredIndex = ref<number | null>(null)

// Point du profil correspondant à la position survolée sur la carte
const cursorIndex = computed(() => {
  const cursor = props.cursor
  if (!cursor) return null
  const [lon, lat] = cursor.coordinates
  const points = flatPoints.value
  let best: number | null = null
  let bestDistance = Infinity
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    if (p.segment.id !== cursor.segmentId) continue
    const distance = (p.coordinates[0] - lon) ** 2 + (p.coordinates[1] - lat) ** 2
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  }
  return best
})

// Le survol direct du profil prime sur la position venue de la carte
const hovered = computed(() => {
  const index = hoveredIndex.value ?? cursorIndex.value
  return index === null ? undefined : flatPoints.value[index]
})

function nearestIndex(km: number): number {
  const points = flatPoints.value
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid]!.x < km) lo = mid + 1
    else hi = mid
  }
  const prev = points[lo - 1]
  return prev && km - prev.x < points[lo]!.x - km ? lo - 1 : lo
}

function setHovered(index: number | null) {
  hoveredIndex.value = index
  const point = index === null ? undefined : flatPoints.value[index]
  emit('hover', point ? { segmentId: point.segment.id, coordinates: point.coordinates } : null)
}

function onPointerMove(e: PointerEvent) {
  if (!flatPoints.value.length) return
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const { left, right } = plot.value
  const ratio = Math.min(Math.max((e.clientX - rect.left - left) / (right - left), 0), 1)
  setHovered(nearestIndex(ratio * totalKm.value))
}

// Même lecture au clavier qu'à la souris : flèches pour avancer, Échap pour sortir
function onKeydown(e: KeyboardEvent) {
  const count = flatPoints.value.length
  if (!count) return
  const step = Math.max(1, Math.round(count / 100))
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const current = hoveredIndex.value ?? (e.key === 'ArrowRight' ? -step : count)
    const next = current + (e.key === 'ArrowRight' ? step : -step)
    setHovered(Math.min(Math.max(next, 0), count - 1))
  }
  if (e.key === 'Escape') setHovered(null)
}

const tooltipStyle = computed(() => {
  if (!hovered.value) return {}
  const x = xPos(hovered.value.x)
  // Bascule à gauche du curseur près du bord droit pour ne pas déborder
  const flip = x > width.value * 0.65
  return {
    left: `${x}px`,
    transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
  }
})

function formatKm(km: number): string {
  return `${km.toFixed(1)} km`
}
</script>

<template>
  <figure v-if="flatPoints.length > 1" class="profile">
    <div
      ref="container"
      class="chart"
      tabindex="0"
      role="img"
      :aria-label="`Profil d'altitude, de ${Math.round(elevationRange.min)} à ${Math.round(elevationRange.max)} m sur ${formatKm(totalKm)}`"
      @keydown="onKeydown"
      @blur="setHovered(null)"
    >
      <svg
        v-if="width"
        :width="width"
        :height="HEIGHT"
        class="svg"
        @pointermove="onPointerMove"
        @pointerleave="setHovered(null)"
      >
        <g class="grid">
          <g v-for="tick in yScale.ticks" :key="`y${tick}`">
            <line :x1="plot.left" :x2="plot.right" :y1="yPos(tick)" :y2="yPos(tick)" />
            <text :x="plot.left - 8" :y="yPos(tick)" class="y-label">{{ tick }} m</text>
          </g>
          <text
            v-for="tick in xTicks"
            :key="`x${tick}`"
            :x="xPos(tick)"
            :y="HEIGHT - 6"
            class="x-label"
          >
            {{ tick }} km
          </text>
        </g>

        <g
          v-for="path in paths"
          :key="path.id"
          class="series"
          :class="{ 'is-dimmed': highlightedId && highlightedId !== path.id }"
        >
          <path :d="path.area" :fill="path.color" class="area" />
          <path :d="path.line" :stroke="path.color" class="line" />
        </g>

        <g v-if="hovered" class="crosshair">
          <line :x1="xPos(hovered.x)" :x2="xPos(hovered.x)" :y1="plot.top" :y2="plot.bottom" />
          <circle
            :cx="xPos(hovered.x)"
            :cy="yPos(hovered.elevation)"
            r="5"
            :fill="hovered.segment.color"
          />
        </g>
      </svg>

      <div v-if="hovered" class="tooltip" :style="tooltipStyle" aria-live="polite">
        <strong>{{ Math.round(hovered.elevation) }} m</strong>
        <span>
          <span
            v-if="segments.length > 1"
            class="key"
            :style="{ background: hovered.segment.color }"
          />
          {{ formatKm(hovered.x)
          }}<template v-if="segments.length > 1"> · {{ hovered.segment.label }}</template>
        </span>
      </div>
    </div>

    <figcaption class="caption">
      <ul v-if="segments.length > 1" class="legend">
        <li v-for="segment in segments" :key="segment.id">
          <span class="key" :style="{ background: segment.color }" />{{ segment.label }}
        </li>
      </ul>
      <span class="range">
        Alt. min {{ Math.round(elevationRange.min) }} m · max {{ Math.round(elevationRange.max) }} m
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.profile {
  margin: var(--space-md) 0;
}
.chart {
  position: relative;
  height: 160px;
  border-radius: var(--radius);
  outline-offset: 2px;
}
.chart:focus-visible {
  outline: 2px solid var(--color-accent);
}
.svg {
  display: block;
  overflow: visible;
  cursor: crosshair;
  touch-action: pan-y;
}
.grid line {
  stroke: rgba(232, 228, 217, 0.1);
  stroke-width: 1;
}
.grid text {
  fill: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.y-label {
  text-anchor: end;
  dominant-baseline: middle;
}
.x-label {
  text-anchor: middle;
}
.series {
  transition: opacity 0.15s ease;
}
.series.is-dimmed {
  opacity: 0.3;
}
.area {
  fill-opacity: 0.12;
}
.line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.crosshair line {
  stroke: var(--color-text-muted);
  stroke-width: 1;
}
.crosshair circle {
  stroke: var(--color-bg);
  stroke-width: 2;
}
.tooltip {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.35rem 0.6rem;
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
  pointer-events: none;
}
.tooltip strong {
  color: var(--color-text);
  font-size: 0.95rem;
}
.caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-xs) var(--space-sm);
  margin-top: var(--space-xs);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem var(--space-sm);
  list-style: none;
  padding: 0;
  margin: 0;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
/* Clé de série : un trait court de la couleur, le texte reste dans les couleurs de texte */
.key {
  display: inline-block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
  vertical-align: middle;
  margin-right: 0.35rem;
}
.legend .key {
  margin-right: 0;
}
</style>
