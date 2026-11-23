interface HeroBackFigureProps {
  className?: string
  label?: string
  asset?: 'front' | 'back'
}

export function HeroBackFigure({ className = '', label = '迪迦奥特曼背面', asset = 'back' }: HeroBackFigureProps) {
  const source = asset === 'front'
    ? '/assets/animation/tiga-full-body-front-generated.png'
    : '/assets/animation/tiga-full-body-back-generated.png'

  return (
    <div className={`hero-back-figure ${className}`.trim()} role="img" aria-label={label}>
      <img
        className="hero-back-figure__image"
        src={source}
        alt=""
      />
    </div>
  )
}
