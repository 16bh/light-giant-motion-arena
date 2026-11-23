import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type GestureId =
  | 'guard'
  | 'beam'
  | 'dodge-left'
  | 'dodge-right'
  | 'charge'
  | 'punch-left'
  | 'punch-right'
  | 'kick-left'
  | 'kick-right'
  | 'wave-both'
  | 'finisher'
export type BossPhase = 1 | 2 | 3
export type TimingGrade = 'perfect' | 'good' | 'miss' | 'finisher'
export type GamePhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost'
export type PoseStatus = 'idle' | 'loading' | 'active' | 'denied' | 'error'

export interface GestureDefinition {
  id: GestureId
  label: string
  cue: string
  reward: number
  energyDelta: number
}

export interface BossDefinition {
  id: string
  name: string
  epithet: string
  scene: string
  battleScene?: string
  spritePrefix: string
  phaseSequences: Record<BossPhase, GestureId[]>
  color: string
  accent: string
}

export interface HeroDefinition {
  id: 'tiga'
  name: string
  epithet: string
  specialty: string
  power: number
  speed: number
  energy: number
}

export interface PoseFrame {
  landmarks: NormalizedLandmark[] | null
  gesture: GestureId | null
  confidence: number
  detected: boolean
  calibrated: boolean
}

export interface BattleState {
  phase: GamePhase
  bossIndex: number
  playerHealth: number
  bossHealth: number
  energy: number
  combo: number
  score: number
  timeLeft: number
  round: number
  bossPhase: BossPhase
  target: GestureId
  message: string
  impact: 'player' | 'boss' | 'guard' | null
}
