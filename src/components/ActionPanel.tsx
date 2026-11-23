import { GESTURES } from '../gameData'
import { GestureIcon } from './GestureIcon'
import type { GestureId } from '../types'

interface ActionPanelProps {
  target: GestureId
  energy: number
  combo: number
  score: number
  message: string
  demo: boolean
  finisherAvailable: boolean
  onDemoGesture: (gesture: GestureId) => void
  onFinisher: () => void
}

export function ActionPanel({
  target,
  energy,
  combo,
  score,
  message,
  demo,
  finisherAvailable,
  onDemoGesture,
  onFinisher,
}: ActionPanelProps) {
  const gesture = GESTURES[target]
  const comboTier = combo >= 20 ? 'x3' : combo >= 10 ? 'x2' : combo >= 5 ? 'x1.5' : 'x1'

  return (
    <div className="battle-bottom">
      <section className="action-panel" aria-live="polite">
        <div className="action-panel__icon">
          <GestureIcon gesture={target} size={50} strokeWidth={1.65} />
          <i />
        </div>
        <div className="action-panel__copy">
          <span>NEXT MOVE</span>
          <strong>{gesture.label}</strong>
          <small>{message || gesture.cue}</small>
        </div>
        <div className="battle-score">
          <div><span>连击</span><strong>{combo}</strong><em>{comboTier}</em></div>
          <div><span>得分</span><strong>{String(score).padStart(5, '0')}</strong></div>
        </div>
      </section>

      <div className="energy-rail">
        <span>ENERGY</span>
        <div className="energy-rail__track">
          <i style={{ width: `${energy}%` }} />
          {[20, 40, 60, 80].map((mark) => <b key={mark} style={{ left: `${mark}%` }} />)}
        </div>
        <strong>{Math.round(energy)}</strong>
      </div>

      {demo ? (
        <div className="demo-controls" aria-label="体验模式动作">
          {(Object.keys(GESTURES) as GestureId[]).filter((gestureId) => gestureId !== 'finisher').map((gestureId) => (
            <button key={gestureId} type="button" onClick={() => onDemoGesture(gestureId)} title={GESTURES[gestureId].label} aria-label={GESTURES[gestureId].label}>
              <GestureIcon gesture={gestureId} size={21} />
            </button>
          ))}
        </div>
      ) : null}

      {finisherAvailable ? (
        <button className="finisher-command" type="button" onClick={onFinisher} aria-label="释放奥特必杀">
          <GestureIcon gesture="finisher" size={19} />
          <span>奥特必杀</span>
          <small>消耗 100 ENERGY</small>
        </button>
      ) : null}
    </div>
  )
}
