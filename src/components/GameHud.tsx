import { Camera, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import type { BossDefinition, GamePhase, HeroDefinition } from '../types'

interface GameHudProps {
  hero: HeroDefinition
  boss: BossDefinition
  playerHealth: number
  bossHealth: number
  bossMaxHealth: number
  bossPhase: number
  round: number
  timeLeft: number
  phase: GamePhase
  muted: boolean
  cameraActive: boolean
  onPause: () => void
  onMute: () => void
}

export function GameHud({
  hero,
  boss,
  playerHealth,
  bossHealth,
  bossMaxHealth,
  bossPhase,
  round,
  timeLeft,
  phase,
  muted,
  cameraActive,
  onPause,
  onMute,
}: GameHudProps) {
  return (
    <header className="game-hud">
      <div className="game-hud__brand">
        <span>U</span>
        <strong>光之格斗场</strong>
      </div>
      <div className="health health--player">
        <div className="health__label">
          <strong>{hero.name}</strong>
          <span>{Math.ceil(playerHealth)}%</span>
        </div>
        <div className="health__track">
          <i style={{ width: `${Math.max(0, playerHealth)}%` }} />
        </div>
      </div>
      <div className="round-timer" aria-label={`剩余 ${timeLeft} 秒`}>
        <span>ROUND {String(round).padStart(2, '0')}</span>
        <strong>{String(timeLeft).padStart(3, '0')}</strong>
      </div>
      <div className="health health--boss">
        <div className="health__label">
          <span>{Math.ceil((bossHealth / bossMaxHealth) * 100)}%</span>
          <strong>{boss.name}<em>PHASE {bossPhase}</em></strong>
        </div>
        <div className="health__track">
          <i style={{ width: `${Math.max(0, Math.min(100, (bossHealth / bossMaxHealth) * 100))}%`, backgroundColor: boss.color }} />
        </div>
      </div>
      <nav className="hud-controls" aria-label="游戏控制">
        <button className="icon-button" type="button" onClick={onMute} aria-label={muted ? '打开声音' : '静音'} title={muted ? '打开声音' : '静音'}>
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
        <span className={`camera-indicator ${cameraActive ? 'is-active' : ''}`} title={cameraActive ? '摄像头已连接' : '体验模式'}>
          <Camera aria-hidden="true" />
        </span>
        <button className="icon-button" type="button" onClick={onPause} aria-label={phase === 'paused' ? '继续' : '暂停'} title={phase === 'paused' ? '继续' : '暂停'}>
          {phase === 'paused' ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      </nav>
    </header>
  )
}
