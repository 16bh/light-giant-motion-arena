import type { CSSProperties } from 'react'
import { getMirroredBodyCenter } from './pose'
import type { PoseFrame } from './types'


const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))


export function getArmStyle(landmarks: PoseFrame['landmarks'], side: 'left' | 'right'): CSSProperties {
  if (!landmarks) {
    return {
      '--arm-x': '0px',
      '--arm-y': '0px',
      '--arm-rotation': '0deg',
      '--arm-scale': '1',
    } as CSSProperties
  }

  const wristIndex = side === 'left' ? 15 : 16
  const elbowIndex = side === 'left' ? 13 : 14
  const wrist = landmarks[wristIndex]
  const elbow = landmarks[elbowIndex]
  const mirroredWristX = 1 - wrist.x
  const mirroredElbowX = 1 - elbow.x
  const neutralX = side === 'left' ? 0.28 : 0.72
  const horizontal = clamp((mirroredWristX - neutralX) * 250, -95, 95)
  const vertical = clamp((wrist.y - 0.56) * 260, -105, 75)
  const direction = Math.atan2(wrist.y - elbow.y, mirroredWristX - mirroredElbowX) * 180 / Math.PI
  const neutralDirection = side === 'left' ? -18 : -162
  const rotation = clamp(direction - neutralDirection, -30, 30)
  const depth = clamp(1 + (((elbow.z ?? 0) - (wrist.z ?? 0)) * 1.25), 0.86, 1.34)

  return {
    '--arm-x': `${horizontal}px`,
    '--arm-y': `${vertical}px`,
    '--arm-rotation': `${rotation}deg`,
    '--arm-scale': String(depth),
  } as CSSProperties
}

export function getLegStyle(landmarks: PoseFrame['landmarks'], side: 'left' | 'right'): CSSProperties {
  if (!landmarks) {
    return {
      '--leg-x': '0px',
      '--leg-y': '0px',
      '--leg-rotation': '0deg',
      '--leg-scale': '1',
    } as CSSProperties
  }

  const ankleIndex = side === 'left' ? 27 : 28
  const kneeIndex = side === 'left' ? 25 : 26
  const ankle = landmarks[ankleIndex]
  const knee = landmarks[kneeIndex]
  const mirroredAnkleX = 1 - ankle.x
  const neutralX = side === 'left' ? 0.37 : 0.63
  const horizontal = clamp((mirroredAnkleX - neutralX) * 190, -110, 110)
  const vertical = clamp((ankle.y - 0.82) * 180, -115, 80)
  const direction = Math.atan2(ankle.y - knee.y, mirroredAnkleX - (1 - knee.x)) * 180 / Math.PI
  const neutralDirection = side === 'left' ? 78 : 102
  const rotation = clamp(direction - neutralDirection, -38, 38)
  const depth = clamp(1 + (((knee.z ?? 0) - (ankle.z ?? 0)) * 1.1), 0.9, 1.3)

  return {
    '--leg-x': `${horizontal}px`,
    '--leg-y': `${vertical}px`,
    '--leg-rotation': `${rotation}deg`,
    '--leg-scale': String(depth),
  } as CSSProperties
}


export function getMotionTracking(landmarks: PoseFrame['landmarks']) {
  const bodyCenter = landmarks ? getMirroredBodyCenter(landmarks) : 0.5
  return {
    monsterOffset: clamp((bodyCenter - 0.5) * 220, -105, 105),
    leftArmStyle: getArmStyle(landmarks, 'left'),
    rightArmStyle: getArmStyle(landmarks, 'right'),
    leftLegStyle: getLegStyle(landmarks, 'left'),
    rightLegStyle: getLegStyle(landmarks, 'right'),
  }
}
