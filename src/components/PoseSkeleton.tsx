import type { GestureId } from '../types'


type Joint =
  | 'head'
  | 'neck'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'

type Point = [number, number]
type Skeleton = Record<Joint, Point>

const BASE: Skeleton = {
  head: [50, 12],
  neck: [50, 25],
  leftShoulder: [62, 31],
  rightShoulder: [38, 31],
  leftElbow: [69, 48],
  rightElbow: [31, 48],
  leftWrist: [72, 65],
  rightWrist: [28, 65],
  leftHip: [57, 67],
  rightHip: [43, 67],
  leftKnee: [59, 88],
  rightKnee: [41, 88],
  leftAnkle: [61, 111],
  rightAnkle: [39, 111],
}

const withChanges = (changes: Partial<Skeleton>): Skeleton => ({ ...BASE, ...changes })

const offset = (skeleton: Skeleton, amount: number): Skeleton =>
  Object.fromEntries(Object.entries(skeleton).map(([joint, [x, y]]) => [joint, [x + amount, y]])) as Skeleton

const POSES: Record<GestureId, Skeleton> = {
  'punch-left': withChanges({
    leftElbow: [64, 31],
    leftWrist: [64, 8],
    rightElbow: [35, 46],
    rightWrist: [28, 65],
  }),
  'punch-right': withChanges({
    rightElbow: [36, 31],
    rightWrist: [36, 8],
    leftElbow: [65, 46],
    leftWrist: [72, 65],
  }),
  'kick-left': withChanges({
    leftKnee: [72, 78],
    leftAnkle: [91, 73],
    rightKnee: [40, 88],
    rightAnkle: [39, 112],
  }),
  'kick-right': withChanges({
    rightKnee: [28, 78],
    rightAnkle: [9, 73],
    leftKnee: [60, 88],
    leftAnkle: [61, 112],
  }),
  guard: withChanges({
    leftElbow: [79, 39],
    leftWrist: [95, 39],
    rightElbow: [21, 39],
    rightWrist: [5, 39],
  }),
  'wave-both': withChanges({
    leftElbow: [72, 38],
    leftWrist: [84, 22],
    rightElbow: [28, 38],
    rightWrist: [16, 22],
  }),
  finisher: withChanges({
    leftElbow: [75, 36],
    leftWrist: [88, 23],
    rightElbow: [25, 36],
    rightWrist: [12, 23],
  }),
  charge: withChanges({
    leftElbow: [65, 28],
    leftWrist: [69, 10],
    rightElbow: [35, 28],
    rightWrist: [31, 10],
  }),
  beam: withChanges({
    leftElbow: [65, 43],
    leftWrist: [38, 43],
    rightElbow: [35, 29],
    rightWrist: [35, 8],
  }),
  'dodge-left': offset(BASE, -12),
  'dodge-right': offset(BASE, 12),
}

const EDGES: Array<[Joint, Joint]> = [
  ['neck', 'leftShoulder'],
  ['neck', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['neck', 'leftHip'],
  ['neck', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
]

interface PoseSkeletonProps {
  gesture: GestureId
}

export function PoseSkeleton({ gesture }: PoseSkeletonProps) {
  const pose = POSES[gesture]
  return (
    <svg className="pose-skeleton" viewBox="0 0 100 120" role="img" aria-label="动作骨架示意">
      <circle className="pose-skeleton__head" cx={pose.head[0]} cy={pose.head[1]} r="7" />
      {EDGES.map(([from, to]) => (
        <line
          key={`${from}-${to}`}
          x1={pose[from][0]}
          y1={pose[from][1]}
          x2={pose[to][0]}
          y2={pose[to][1]}
        />
      ))}
      {Object.entries(pose).filter(([joint]) => joint !== 'head').map(([joint, [x, y]]) => (
        <circle
          key={joint}
          className={joint.includes('Wrist') || joint.includes('Ankle') ? 'is-endpoint' : ''}
          cx={x}
          cy={y}
          r={joint.includes('Wrist') || joint.includes('Ankle') ? 3.1 : 2.2}
        />
      ))}
    </svg>
  )
}
