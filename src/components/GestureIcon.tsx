import {
  ArrowLeftFromLine,
  ArrowRightFromLine,
  BicepsFlexed,
  Footprints,
  Shield,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react'
import type { GestureId } from '../types'

const ICONS = {
  guard: Shield,
  beam: Zap,
  'dodge-left': ArrowLeftFromLine,
  'dodge-right': ArrowRightFromLine,
  charge: Sparkles,
  'punch-left': BicepsFlexed,
  'punch-right': BicepsFlexed,
  'kick-left': Footprints,
  'kick-right': Footprints,
  'wave-both': Waves,
  finisher: Sparkles,
}

interface GestureIconProps {
  gesture: GestureId
  size?: number
  strokeWidth?: number
}

export function GestureIcon({ gesture, size = 32, strokeWidth = 1.9 }: GestureIconProps) {
  const Icon = ICONS[gesture]
  const mirrored = gesture === 'punch-right' || gesture === 'kick-right'
  return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} />
}
