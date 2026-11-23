import { X } from 'lucide-react'
import { GESTURES } from '../gameData'
import type { GestureId } from '../types'
import { PoseSkeleton } from './PoseSkeleton'


const GUIDE_ORDER: GestureId[] = [
  'punch-left',
  'punch-right',
  'kick-left',
  'kick-right',
  'dodge-left',
  'dodge-right',
  'guard',
  'wave-both',
  'charge',
  'beam',
]

const GUIDE_CUES: Partial<Record<GestureId, string>> = {
  'wave-both': '双手同时快速挥动，连续识别 4 次',
  beam: '一臂在脸侧竖起，另一臂横置胸前，组成 L 型并保持 0.6 秒',
  guard: '双臂向两侧伸直，和肩膀保持一条水平线',
  'dodge-left': '上身和髋部一起快速移向左侧',
  'dodge-right': '上身和髋部一起快速移向右侧',
}

interface InstructionsModalProps {
  onClose: () => void
}

export function InstructionsModal({ onClose }: InstructionsModalProps) {
  return (
    <section className="instructions-modal" role="dialog" aria-modal="true" aria-labelledby="instructions-title">
      <div className="instructions-modal__header">
        <div>
          <span>MOTION GUIDE</span>
          <h2 id="instructions-title">动作骨架说明</h2>
          <p>正对摄像头并确保全身入镜，黄色节点表示需要重点移动的手腕与脚踝。</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭动作说明" title="关闭">
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="instructions-grid">
        {GUIDE_ORDER.map((gesture) => (
          <article className="pose-guide" key={gesture}>
            <PoseSkeleton gesture={gesture} />
            <div>
              <strong>{GESTURES[gesture].label}</strong>
              <p>{GUIDE_CUES[gesture] ?? GESTURES[gesture].cue}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
