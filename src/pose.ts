import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { GestureId } from './types'

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const angle = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) => {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)
  if (!denominator) return 0
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denominator))
  return (Math.acos(cosine) * 180) / Math.PI
}

export const getMirroredBodyCenter = (landmarks: NormalizedLandmark[]) => {
  const center = (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4
  return 1 - center
}

export const inferGesture = (
  landmarks: NormalizedLandmark[],
  baselineX: number,
  previousLandmarks: NormalizedLandmark[] | null = null,
): { gesture: GestureId | null; confidence: number } => {
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const leftElbow = landmarks[13]
  const rightElbow = landmarks[14]
  const leftWrist = landmarks[15]
  const rightWrist = landmarks[16]
  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const leftKnee = landmarks[25]
  const rightKnee = landmarks[26]
  const leftAnkle = landmarks[27]
  const rightAnkle = landmarks[28]

  const visible = [
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
  ].every((point) => (point.visibility ?? 1) > 0.45)

  if (!visible) return { gesture: null, confidence: 0 }

  const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 0.12)
  const bodyCenter = getMirroredBodyCenter(landmarks)
  const centerDelta = bodyCenter - baselineX
  const chest = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2 + shoulderWidth * 0.32,
    z: 0,
    visibility: 1,
  }
  const pointMotion = (index: number) => {
    if (!previousLandmarks) return 0
    const current = landmarks[index]
    const previous = previousLandmarks[index]
    return Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
      ((current.z ?? 0) - (previous.z ?? 0)) * 0.6,
    )
  }

  const guardLeftStraight =
    angle(leftShoulder, leftElbow, leftWrist) > 132 &&
    Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 1.15 &&
    Math.abs(leftWrist.x - leftShoulder.x) > shoulderWidth * 0.52
  const guardRightStraight =
    angle(rightShoulder, rightElbow, rightWrist) > 132 &&
    Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 1.15 &&
    Math.abs(rightWrist.x - rightShoulder.x) > shoulderWidth * 0.52
  const guardLevel = Math.abs(leftWrist.y - rightWrist.y) < shoulderWidth * 0.72
  const guardAtChest = Math.abs((leftWrist.y + rightWrist.y) / 2 - chest.y) < shoulderWidth * 1.15

  if (guardLeftStraight && guardRightStraight && guardLevel && guardAtChest) {
    return { gesture: 'guard', confidence: 0.96 }
  }

  const leftMotion = pointMotion(15)
  const rightMotion = pointMotion(16)
  const handsAboveHips = leftWrist.y < leftHip.y && rightWrist.y < rightHip.y
  if (handsAboveHips && leftMotion > 0.034 && rightMotion > 0.034) {
    return { gesture: 'wave-both', confidence: Math.min(0.98, 0.78 + leftMotion + rightMotion) }
  }

  const leftArmAngle = angle(leftShoulder, leftElbow, leftWrist)
  const rightArmAngle = angle(rightShoulder, rightElbow, rightWrist)
  const leftHorizontal =
    Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.8 &&
    Math.abs(leftWrist.x - leftShoulder.x) > shoulderWidth * 0.55
  const rightHorizontal =
    Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.8 &&
    Math.abs(rightWrist.x - rightShoulder.x) > shoulderWidth * 0.55
  const leftVertical =
    Math.abs(leftWrist.x - leftShoulder.x) < shoulderWidth * 1.05 &&
    leftWrist.y < leftShoulder.y - shoulderWidth * 0.22
  const rightVertical =
    Math.abs(rightWrist.x - rightShoulder.x) < shoulderWidth * 1.05 &&
    rightWrist.y < rightShoulder.y - shoulderWidth * 0.22
  const leftStraight = leftArmAngle > 135 && (leftHorizontal || leftVertical)
  const rightStraight = rightArmAngle > 135 && (rightHorizontal || rightVertical)
  const leftBent = angle(leftShoulder, leftElbow, leftWrist) < 138 && distance(leftWrist, chest) < shoulderWidth * 1.25
  const rightBent = angle(rightShoulder, rightElbow, rightWrist) < 138 && distance(rightWrist, chest) < shoulderWidth * 1.25

  if ((leftVertical && rightHorizontal && !rightVertical) || (rightVertical && leftHorizontal && !leftVertical)) {
    return { gesture: 'beam', confidence: 0.93 }
  }

  const leftHandRaised = leftVertical
  const rightHandRaised = rightVertical
  const leftHandDown = leftWrist.y > leftShoulder.y - shoulderWidth * 0.12
  const rightHandDown = rightWrist.y > rightShoulder.y - shoulderWidth * 0.12

  if (leftHandRaised && !rightHandRaised && rightHandDown) {
    return { gesture: 'punch-left', confidence: 0.94 }
  }

  if (rightHandRaised && !leftHandRaised && leftHandDown) {
    return { gesture: 'punch-right', confidence: 0.94 }
  }

  const leftForward = (leftWrist.z ?? 0) < (leftShoulder.z ?? 0) - 0.1
  const rightForward = (rightWrist.z ?? 0) < (rightShoulder.z ?? 0) - 0.1
  const leftPunch = leftHorizontal && leftArmAngle > 135 && leftMotion > 0.028 && (leftForward || leftMotion > 0.055)
  const rightPunch = rightHorizontal && rightArmAngle > 135 && rightMotion > 0.028 && (rightForward || rightMotion > 0.055)

  if (leftPunch || rightPunch) {
    return leftMotion >= rightMotion
      ? { gesture: 'punch-left', confidence: Math.min(0.98, 0.78 + leftMotion) }
      : { gesture: 'punch-right', confidence: Math.min(0.98, 0.78 + rightMotion) }
  }

  const raised = leftWrist.y < leftShoulder.y - 0.035 && rightWrist.y < rightShoulder.y - 0.035
  if (raised) {
    return { gesture: 'charge', confidence: 0.9 }
  }

  const legsVisible = [leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle]
    .every((point) => (point.visibility ?? 1) > 0.42)
  if (legsVisible) {
    const leftLegMotion = pointMotion(27)
    const rightLegMotion = pointMotion(28)
    const leftLegExtended = angle(leftHip, leftKnee, leftAnkle) > 122
    const rightLegExtended = angle(rightHip, rightKnee, rightAnkle) > 122
    const leftKneeRaised = leftKnee.y < leftHip.y + 0.24
    const rightKneeRaised = rightKnee.y < rightHip.y + 0.24
    const leftLegForward = (leftAnkle.z ?? 0) < (leftHip.z ?? 0) - 0.09
    const rightLegForward = (rightAnkle.z ?? 0) < (rightHip.z ?? 0) - 0.09
    const leftLegSideward = leftAnkle.x > leftHip.x + shoulderWidth * 0.16
    const rightLegSideward = rightAnkle.x < rightHip.x - shoulderWidth * 0.16
    const leftKick = leftLegMotion > 0.028 && leftKneeRaised && leftLegExtended && (leftLegSideward || leftLegForward || leftLegMotion > 0.052)
    const rightKick = rightLegMotion > 0.028 && rightKneeRaised && rightLegExtended && (rightLegSideward || rightLegForward || rightLegMotion > 0.052)

    if (leftKick || rightKick) {
      return leftLegMotion >= rightLegMotion
        ? { gesture: 'kick-left', confidence: Math.min(0.98, 0.78 + leftLegMotion) }
        : { gesture: 'kick-right', confidence: Math.min(0.98, 0.78 + rightLegMotion) }
    }
  }

  if (centerDelta > 0.06) {
    return { gesture: 'dodge-right', confidence: Math.min(0.98, 0.72 + centerDelta) }
  }

  if (centerDelta < -0.06) {
    return { gesture: 'dodge-left', confidence: Math.min(0.98, 0.72 + Math.abs(centerDelta)) }
  }

  return { gesture: null, confidence: 0 }
}

export const POSE_EDGES: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
]
