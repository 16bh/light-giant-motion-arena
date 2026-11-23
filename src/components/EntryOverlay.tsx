import { ScanLine, Sparkles } from 'lucide-react'
import { HeroBackFigure } from './HeroBackFigure'

interface EntryOverlayProps {
  stage: 'camera' | 'fusion' | 'hero-arrival' | 'monster-arrival'
  cameraActive: boolean
  demo: boolean
  bossName: string
  bossSprite: string
}

export function EntryOverlay({ stage, cameraActive, demo, bossName, bossSprite }: EntryOverlayProps) {
  const cameraStage = stage === 'camera'
  const fusionStage = stage === 'fusion'
  const heroArrivalStage = stage === 'hero-arrival'
  const monsterArrivalStage = stage === 'monster-arrival'
  const status = cameraStage
    ? demo
      ? '模拟镜头已就位'
      : cameraActive
        ? '已检测到玩家，准备融合'
        : '正在连接摄像头'
    : fusionStage
      ? '玩家与光之巨人同步中'
      : heroArrivalStage
        ? '光之巨人已完成降临'
        : `${bossName} 进入战场`

  return (
    <section className={`entry-overlay entry-overlay--${stage}`} role="status" aria-live="polite">
      {fusionStage ? (
        <div className="entry-overlay__fusion-hero" aria-hidden="true">
          <div className="entry-overlay__fusion-person" />
          <div className="entry-overlay__fusion-crest">U</div>
          <HeroBackFigure className="entry-overlay__fusion-body" label="合体中的光之巨人" asset="front" />
        </div>
      ) : null}
      {heroArrivalStage ? (
        <div className="entry-overlay__hero-arrival" aria-hidden="true">
          <div className="entry-overlay__arrival-starfield" />
          <HeroBackFigure className="entry-overlay__arrival-body" label="降临战场的光之巨人" asset="front" />
          <i className="entry-overlay__arrival-impact" />
        </div>
      ) : null}
      {monsterArrivalStage ? (
        <div className="entry-overlay__monster-arrival" aria-hidden="true">
          <div className="entry-overlay__monster-smoke" />
          <img src={bossSprite} alt="" />
          <i />
        </div>
      ) : null}
      <div className="entry-overlay__frame">
        <span className="entry-overlay__eyebrow">
          {cameraStage ? 'PLAYER ENTRY' : fusionStage ? 'LIGHT FUSION' : heroArrivalStage ? 'HERO ARRIVAL' : 'MONSTER ARRIVAL'}
        </span>
        <div className="entry-overlay__icon" aria-hidden="true">
          {cameraStage ? <ScanLine /> : <Sparkles />}
        </div>
        <strong>
          {cameraStage
            ? cameraActive || demo
              ? '玩家入场'
              : '开启摄像头'
            : fusionStage
              ? '光之融合'
              : heroArrivalStage
                ? '巨人降临'
                : `${bossName} · 近景锁定`}
        </strong>
        <span>{status}</span>
        <div className="entry-overlay__meter" aria-hidden="true">
          <i style={{ width: cameraStage ? (cameraActive || demo ? '68%' : '28%') : '100%' }} />
        </div>
      </div>
    </section>
  )
}
