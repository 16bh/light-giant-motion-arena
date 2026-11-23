import { useEffect, useState } from 'react'
import { BookOpen, Camera, FastForward, Gamepad2, Volume2, VolumeX } from 'lucide-react'
import { InstructionsModal } from './InstructionsModal'
import { HeroBackFigure } from './HeroBackFigure'
import type { BossDefinition } from '../types'

interface StartScreenProps {
  loading: boolean
  cameraError: string
  muted: boolean
  audioReady: boolean
  bosses: BossDefinition[]
  selectedBossIndex: number
  onSelectBoss: (index: number) => void
  onSoundToggle: () => void
  onStartCamera: () => void
  onStartDemo: () => void
}

export function StartScreen({ loading, cameraError, muted, audioReady, bosses, selectedBossIndex, onSelectBoss, onSoundToggle, onStartCamera, onStartDemo }: StartScreenProps) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [introStage, setIntroStage] = useState<'hero' | 'ready'>('hero')
  const selectedBoss = bosses[selectedBossIndex]

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroStage('ready'), 2800)
    return () => window.clearTimeout(timer)
  }, [])

  if (introStage === 'hero') {
    return (
      <main className="start-screen start-screen--hero" aria-labelledby="hero-entrance-title">
        <div className="start-screen__scene" aria-hidden="true" />
        <div className="start-screen__shade" aria-hidden="true" />
        <section className="hero-entrance">
          <div className="hero-entrance__halo" aria-hidden="true" />
          <div className="hero-entrance__starfield" aria-hidden="true" />
          <div className="hero-entrance__crest" aria-hidden="true">U</div>
          <HeroBackFigure className="hero-entrance__full-hero" label="入场中的迪迦奥特曼" asset="front" />
          <i className="hero-entrance__landing-ring" aria-hidden="true" />
          <div className="hero-entrance__copy">
            <span>LIGHT GIANT ARRIVAL</span>
            <h1 id="hero-entrance-title">迪迦奥特曼</h1>
            <p>光之巨人，准备降临战场</p>
          </div>
          <div className="hero-entrance__progress" aria-hidden="true"><i /><i /><i /></div>
          <button className="text-command hero-entrance__skip" type="button" onClick={() => setIntroStage('ready')}>
            <FastForward aria-hidden="true" />跳过特写
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className={`start-screen start-screen--boss-${selectedBoss.id}`}>
      <div className="start-screen__scene" style={{ backgroundImage: `url(${selectedBoss.battleScene ?? selectedBoss.scene})` }} aria-label={`迪迦奥特曼对战${selectedBoss.name}`} />
      <div className="start-screen__shade" aria-hidden="true" />
      <img className="start-screen__boss" src={`${selectedBoss.spritePrefix}-0.png`} alt="" aria-hidden="true" />
      <img className="start-screen__hero-arm start-screen__hero-arm--left" src="/assets/animation/tiga-arm.png" alt="" aria-hidden="true" />
      <img className="start-screen__hero-arm start-screen__hero-arm--right" src="/assets/animation/tiga-arm-right.png" alt="" aria-hidden="true" />
      <header className="start-header">
        <div className="brand-lockup">
          <span className="brand-lockup__mark">U</span>
          <div>
            <strong>光之格斗场</strong>
            <span>MOTION ARENA</span>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onSoundToggle} aria-label={muted ? '打开声音' : audioReady ? '静音' : '启用声音'} title={muted ? '打开声音' : audioReady ? '静音' : '启用声音'}>
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
      </header>

      <section className="start-command" aria-labelledby="start-title">
        <span>FIRST PERSON BATTLE</span>
        <h1 id="start-title">迪迦奥特曼 <i>VS</i> {selectedBoss.name}</h1>
        <p>站到摄像头前，准备战斗</p>
        <div className="boss-picker" aria-label="选择怪兽">
          {bosses.map((boss, index) => (
            <button
              className={`boss-picker__option ${index === selectedBossIndex ? 'is-selected' : ''} boss-picker__option--${boss.id}`}
              key={boss.id}
              type="button"
              aria-pressed={index === selectedBossIndex}
              onClick={() => onSelectBoss(index)}
              disabled={loading}
            >
              <span className={`boss-picker__portrait boss-picker__portrait--${boss.id}`} style={{ backgroundImage: `url(${boss.spritePrefix}-0.png)` }} />
              <span className="boss-picker__copy">
                <strong>{boss.name}</strong>
                <small>{boss.epithet}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="start-command__actions">
          <button className="secondary-command" type="button" onClick={() => setShowInstructions(true)} disabled={loading}>
            <BookOpen aria-hidden="true" />
            动作说明
          </button>
          <button className="secondary-command" type="button" onClick={onStartDemo} disabled={loading}>
            <Gamepad2 aria-hidden="true" />
            体验模式
          </button>
          <button className="primary-command" type="button" onClick={onStartCamera} disabled={loading}>
            <Camera aria-hidden="true" />
            {loading ? '正在启动识别' : '摄像头开战'}
          </button>
        </div>
        <p className="camera-error" role="status">{cameraError}</p>
      </section>
      {showInstructions ? <InstructionsModal onClose={() => setShowInstructions(false)} /> : null}
    </main>
  )
}
