import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, RefreshCcw, Trophy } from 'lucide-react'
import { ActionPanel } from './components/ActionPanel'
import { CameraFeed } from './components/CameraFeed'
import { EntryOverlay } from './components/EntryOverlay'
import { GameHud } from './components/GameHud'
import { GestureIcon } from './components/GestureIcon'
import { HeroBackFigure } from './components/HeroBackFigure'
import { StartScreen } from './components/StartScreen'
import { ACTION_SEQUENCE, BOSS_MAX_HEALTH, BOSSES, GESTURES, HEROES, STARTING_TIME } from './gameData'
import { usePoseTracking } from './hooks/usePoseTracking'
import { getMotionTracking } from './motionTracking'
import type { BattleState, BossPhase, GestureId, TimingGrade } from './types'

const INITIAL_BATTLE: BattleState = {
  phase: 'ready',
  bossIndex: 0,
  playerHealth: 100,
  bossHealth: BOSS_MAX_HEALTH,
  energy: 44,
  combo: 0,
  score: 0,
  timeLeft: STARTING_TIME,
  round: 1,
  bossPhase: 1,
  target: ACTION_SEQUENCE[0],
  message: '',
  impact: null,
}

const VOICE_PROMPTS: Record<GestureId, string> = {
  guard: '防御，双臂伸直成一字',
  beam: '进攻，释放光线',
  'dodge-left': '右侧来袭，向左躲避',
  'dodge-right': '左侧来袭，向右躲避',
  charge: '举起双手，汇聚能量',
  'punch-left': '进攻，挥出左拳',
  'punch-right': '进攻，挥出右拳',
  'kick-left': '进攻，踢出左腿',
  'kick-right': '进攻，踢出右腿',
  'wave-both': '陨石来袭，双手快速连挥',
  finisher: '能量充满，释放奥特必杀',
}

const VOICE_AUDIO: Record<GestureId, string> = {
  guard: '/assets/audio/guard.wav',
  beam: '/assets/audio/beam.wav',
  'dodge-left': '/assets/audio/dodge-left.wav',
  'dodge-right': '/assets/audio/dodge-right.wav',
  charge: '/assets/audio/charge.wav',
  'punch-left': '/assets/audio/punch-left.wav',
  'punch-right': '/assets/audio/punch-right.wav',
  'kick-left': '/assets/audio/kick-left.wav',
  'kick-right': '/assets/audio/kick-right.wav',
  'wave-both': '/assets/audio/wave-both.wav',
  finisher: '/assets/audio/finisher.wav',
}

const BELIAL_SEQUENCE = [0, 2, 0, 3, 0, 0, 2, 0, 3, 0, 1, 1, 0, 0]

function createTone(context: AudioContext, frequency: number, duration: number, volume: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(frequency, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.65, context.currentTime + duration)
  gain.gain.setValueAtTime(volume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + duration)
}

const getBossPhase = (health: number): BossPhase =>
  health <= BOSS_MAX_HEALTH * 0.4 ? 3 : health <= BOSS_MAX_HEALTH * 0.7 ? 2 : 1

const getComboMultiplier = (combo: number) =>
  combo >= 20 ? 1.6 : combo >= 10 ? 1.35 : combo >= 5 ? 1.15 : 1

function App() {
  const [screen, setScreen] = useState<'select' | 'battle'>('select')
  const [battle, setBattle] = useState<BattleState>(INITIAL_BATTLE)
  const [demo, setDemo] = useState(false)
  const [muted, setMuted] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [lastMove, setLastMove] = useState<GestureId | null>(null)
  const [lastTiming, setLastTiming] = useState<TimingGrade | null>(null)
  const [phaseNotice, setPhaseNotice] = useState<string | null>(null)
  const [effectTick, setEffectTick] = useState(0)
  const [belialFrame, setBelialFrame] = useState(0)
  const [entryStage, setEntryStage] = useState<'camera' | 'fusion' | 'hero-arrival' | 'monster-arrival' | null>(null)
  const [selectedBossIndex, setSelectedBossIndex] = useState(0)
  const battleRef = useRef<BattleState>(INITIAL_BATTLE)
  const actionIndexRef = useRef(0)
  const roundRef = useRef(1)
  const actionDeadlineRef = useRef(0)
  const actionStartedAtRef = useRef(0)
  const lastGestureRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const cameraBootRequestedRef = useRef(false)
  const lastLaughRef = useRef(0)
  const speechTimerRef = useRef<number | null>(null)
  const speechRequestRef = useRef(0)
  const promptAudioRef = useRef<HTMLAudioElement | null>(null)
  const pose = usePoseTracking()

  const hero = HEROES[0]
  const boss = BOSSES[selectedBossIndex]
  const bossIndex = selectedBossIndex
  const scene = boss.battleScene ?? '/assets/animation/arena-background.png'

  const playSound = useCallback((kind: 'hit' | 'guard' | 'hurt' | 'win') => {
    if (muted) return
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const context = audioRef.current ?? new AudioContextClass()
    audioRef.current = context
    const settings = {
      hit: [170, 0.18, 0.055],
      guard: [520, 0.12, 0.035],
      hurt: [92, 0.25, 0.05],
      win: [740, 0.5, 0.045],
    } as const
    const [frequency, duration, volume] = settings[kind]
    if (context.state === 'suspended') {
      void context.resume().then(() => createTone(context, frequency, duration, volume))
      return
    }
    createTone(context, frequency, duration, volume)
  }, [muted])

  const playAudioFile = useCallback((path: string, force = false) => {
    if (muted && !force) return Promise.reject(new Error('muted'))
    const audio = promptAudioRef.current ?? new Audio()
    promptAudioRef.current = audio
    audio.pause()
    audio.src = path
    audio.currentTime = 0
    audio.volume = 1
    return audio.play()
  }, [muted])

  const unlockAudio = useCallback((announcement: string) => {
    setMuted(false)
    setAudioReady(true)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      const context = audioRef.current ?? new AudioContextClass()
      audioRef.current = context
      if (context.state === 'suspended') void context.resume()
    }
    const path = announcement === '声音已开启' ? '/assets/audio/sound-on.wav' : '/assets/audio/ready.wav'
    void playAudioFile(path, true)
  }, [playAudioFile])

  const speakPrompt = useCallback((text: string) => {
    if (muted || !('speechSynthesis' in window)) return
    const synthesis = window.speechSynthesis
    const requestId = speechRequestRef.current + 1
    speechRequestRef.current = requestId
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current)
    synthesis.cancel()
    speechTimerRef.current = window.setTimeout(() => {
      if (requestId !== speechRequestRef.current || muted) return
      synthesis.cancel()
      synthesis.resume()
      const utterance = new SpeechSynthesisUtterance(text)
      const voices = synthesis.getVoices()
      utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ?? null
      utterance.lang = 'zh-CN'
      utterance.rate = 1.08
      utterance.pitch = 0.92
      utterance.volume = 1
      synthesis.speak(utterance)
      speechTimerRef.current = null
    }, 60)
  }, [muted])

  const playGesturePrompt = useCallback((gesture: GestureId) => {
    if (muted) return
    void playAudioFile(VOICE_AUDIO[gesture]).catch(() => speakPrompt(VOICE_PROMPTS[gesture]))
  }, [muted, playAudioFile, speakPrompt])

  const playEvilLaugh = useCallback(() => {
    if (muted) return

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const context = audioRef.current ?? new AudioContextClass()
    audioRef.current = context
    if (context.state === 'suspended') void context.resume()
    const startAt = context.currentTime
    const master = context.createGain()
    const filter = context.createBiquadFilter()
    const delay = context.createDelay(0.8)
    const feedback = context.createGain()
    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(0.24, startAt + 0.16)
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.55)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(980, startAt)
    filter.frequency.exponentialRampToValueAtTime(520, startAt + 1.3)
    delay.delayTime.setValueAtTime(0.2, startAt)
    feedback.gain.setValueAtTime(0.2, startAt)
    master.connect(filter)
    filter.connect(context.destination)
    filter.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(context.destination)

    for (let index = 0; index < 6; index += 1) {
      const syllableAt = startAt + index * 0.18
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const vibrato = context.createOscillator()
      const vibratoGain = context.createGain()
      const baseFrequency = 132 - index * 7
      oscillator.type = index % 2 === 0 ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(baseFrequency, syllableAt)
      oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 0.66, syllableAt + 0.16)
      vibrato.frequency.setValueAtTime(4.4 + index * 0.2, syllableAt)
      vibratoGain.gain.setValueAtTime(8, syllableAt)
      vibrato.connect(vibratoGain)
      vibratoGain.connect(oscillator.frequency)
      gain.gain.setValueAtTime(0.0001, syllableAt)
      gain.gain.exponentialRampToValueAtTime(0.08, syllableAt + 0.035)
      gain.gain.exponentialRampToValueAtTime(0.0001, syllableAt + 0.17)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(syllableAt)
      vibrato.start(syllableAt)
      oscillator.stop(syllableAt + 0.2)
      vibrato.stop(syllableAt + 0.2)
    }
    window.setTimeout(() => {
      master.disconnect()
      filter.disconnect()
      delay.disconnect()
      feedback.disconnect()
    }, 2400)
  }, [muted])

  const selectNextAction = useCallback((phase: BossPhase) => {
    const sequence = boss.phaseSequences[phase]
    const nextIndex = (actionIndexRef.current + 1) % sequence.length
    if (nextIndex === 0) roundRef.current += 1
    actionIndexRef.current = nextIndex
    actionDeadlineRef.current = performance.now() + 6800
    actionStartedAtRef.current = performance.now()
    return sequence[actionIndexRef.current]
  }, [boss.phaseSequences])

  const beginBattle = useCallback((isDemo: boolean) => {
    setDemo(isDemo)
    setScreen('battle')
    setEntryStage(isDemo ? 'fusion' : 'camera')
    actionIndexRef.current = 0
    roundRef.current = 1
    actionDeadlineRef.current = performance.now() + 7200
    actionStartedAtRef.current = performance.now()
    lastGestureRef.current = 0
    setLastMove(null)
    setLastTiming(null)
    setPhaseNotice(null)
    setEffectTick(0)
    setBelialFrame(0)
    const nextBattle: BattleState = {
      ...INITIAL_BATTLE,
      phase: 'playing',
      bossIndex,
      bossPhase: 1,
      target: boss.phaseSequences[1][0],
      message: '准备迎击',
    }
    battleRef.current = nextBattle
    setBattle(nextBattle)
  }, [boss.phaseSequences, bossIndex])

  const startWithCamera = useCallback(() => {
    unlockAudio('准备战斗')
    cameraBootRequestedRef.current = false
    pose.stop()
    beginBattle(false)
  }, [beginBattle, pose.stop, unlockAudio])

  const startDemo = useCallback(() => {
    unlockAudio('准备战斗')
    cameraBootRequestedRef.current = true
    pose.stop()
    beginBattle(true)
  }, [beginBattle, pose.stop, unlockAudio])

  useEffect(() => {
    if (screen !== 'battle' || demo || pose.status !== 'idle' || cameraBootRequestedRef.current) return
    cameraBootRequestedRef.current = true
    void pose.start().then((started) => {
      if (started) return
      cameraBootRequestedRef.current = false
      setScreen('select')
      setEntryStage(null)
      setLastTiming(null)
      setPhaseNotice(null)
      battleRef.current = INITIAL_BATTLE
      setBattle(INITIAL_BATTLE)
    })
  }, [demo, pose.start, pose.status, screen])

  useEffect(() => {
    if (screen !== 'battle' || !entryStage) return
    if (entryStage === 'camera' && !demo && pose.status !== 'active') return
    const stageDuration: Record<Exclude<typeof entryStage, null>, number> = {
      camera: 900,
      fusion: 4200,
      'hero-arrival': 2100,
      'monster-arrival': 2100,
    }
    const nextStage: Record<Exclude<typeof entryStage, null>, Exclude<typeof entryStage, null> | null> = {
      camera: 'fusion',
      fusion: 'hero-arrival',
      'hero-arrival': 'monster-arrival',
      'monster-arrival': null,
    }
    const timeout = window.setTimeout(() => {
      actionDeadlineRef.current = performance.now() + 6800
      actionStartedAtRef.current = performance.now()
      setEntryStage(nextStage[entryStage])
    }, stageDuration[entryStage])
    return () => window.clearTimeout(timeout)
  }, [demo, entryStage, pose.status, screen])

  const resolveGesture = useCallback((gesture: GestureId) => {
    const now = performance.now()
    if (gesture !== 'finisher' && lastGestureRef.current > 0 && now - lastGestureRef.current < 850) return
    if (entryStage) return

    const current = battleRef.current
    if (current.phase !== 'playing') return
    if (gesture !== 'finisher' && gesture !== current.target) {
      lastGestureRef.current = now
      const nextBattle = { ...current, message: '动作不匹配，重新调整' }
      battleRef.current = nextBattle
      setBattle(nextBattle)
      return
    }

    if (gesture === 'beam' && current.energy < 38) {
      actionDeadlineRef.current = now + 6800
      actionStartedAtRef.current = now
      const nextBattle: BattleState = { ...current, target: 'charge', message: '能量不足，先汇聚能量' }
      battleRef.current = nextBattle
      setBattle(nextBattle)
      return
    }

    if (gesture === 'finisher' && current.energy < 100) {
      const nextBattle: BattleState = { ...current, message: '能量未满，继续完成动作' }
      battleRef.current = nextBattle
      setBattle(nextBattle)
      return
    }

    lastGestureRef.current = now
    const definition = GESTURES[gesture]
    const elapsed = Math.max(0, now - actionStartedAtRef.current)
    const timing: TimingGrade = gesture === 'finisher' ? 'finisher' : elapsed <= 2200 ? 'perfect' : 'good'
    const timingMultiplier = timing === 'perfect' ? 1.35 : 1
    const heroPower = hero.power / 76
    const comboBonus = Math.min(current.combo * 0.7, 7)
    const damage = Math.round((definition.reward + comboBonus) * heroPower * timingMultiplier * getComboMultiplier(current.combo))
    const nextBossHealth = Math.max(0, current.bossHealth - damage)
    const nextCombo = current.combo + 1
    const victory = nextBossHealth <= 0
    const nextPhase = getBossPhase(nextBossHealth)
    const phaseChanged = nextPhase !== current.bossPhase
    let nextTarget = current.target
    if (!victory && phaseChanged) {
      actionIndexRef.current = 0
      roundRef.current += 1
      actionDeadlineRef.current = now + 6800
      actionStartedAtRef.current = now
      nextTarget = boss.phaseSequences[nextPhase][0]
    } else if (!victory) {
      nextTarget = selectNextAction(nextPhase)
    }
    const nextBattle: BattleState = {
      ...current,
      phase: victory ? 'won' : current.phase,
      bossHealth: nextBossHealth,
      bossPhase: nextPhase,
      energy: Math.max(0, Math.min(100, current.energy + definition.energyDelta)),
      combo: nextCombo,
      score: current.score + damage * 100 + nextCombo * 20 + (timing === 'perfect' ? 300 : 0) + (timing === 'finisher' ? 1000 : 0),
      target: nextTarget,
      round: roundRef.current,
      message: victory ? '战斗胜利' : phaseChanged ? `${boss.name} 进入阶段 ${nextPhase}` : timing === 'finisher' ? '奥特必杀 · 命中' : `${definition.label} · ${timing === 'perfect' ? '完美命中' : '命中'}`,
      impact: gesture === 'guard' ? 'guard' : 'boss',
    }

    battleRef.current = nextBattle
    setBattle(nextBattle)
    setLastMove(gesture)
    setLastTiming(timing)
    setPhaseNotice(phaseChanged ? `${boss.name} · 阶段 ${nextPhase}` : null)
    setEffectTick((value) => value + 1)
    playSound(gesture === 'guard' ? 'guard' : victory ? 'win' : 'hit')
  }, [boss.name, boss.phaseSequences, entryStage, hero.power, playSound, selectNextAction])

  useEffect(() => {
    if (!demo && pose.frame.gesture) resolveGesture(pose.frame.gesture)
  }, [demo, pose.frame.gesture, resolveGesture])

  useEffect(() => {
    if (battle.phase !== 'playing' || entryStage) return
    const interval = window.setInterval(() => {
      const current = battleRef.current
      if (current.phase !== 'playing') return
      const nextTime = current.timeLeft - 1
      const nextBattle: BattleState = nextTime <= 0
        ? { ...current, timeLeft: 0, phase: 'lost', message: '训练结束' }
        : { ...current, timeLeft: nextTime }
      battleRef.current = nextBattle
      setBattle(nextBattle)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [battle.phase, entryStage])

  useEffect(() => {
    if (battle.phase !== 'playing' || entryStage) return
    const interval = window.setInterval(() => {
      if (performance.now() < actionDeadlineRef.current) return
      actionDeadlineRef.current = performance.now() + 6800
      playSound('hurt')
      setLastMove(null)
      setEffectTick((value) => value + 1)
      const current = battleRef.current
      if (current.phase !== 'playing') return
      const nextHealth = Math.max(0, current.playerHealth - 12)
      setLastTiming('miss')
      setPhaseNotice(null)
      const nextBattle: BattleState = {
        ...current,
        phase: nextHealth <= 0 ? 'lost' : current.phase,
        playerHealth: nextHealth,
        combo: 0,
        target: nextHealth <= 0 ? current.target : selectNextAction(current.bossPhase),
        bossPhase: current.bossPhase,
        message: nextHealth <= 0 ? '能量耗尽' : '动作未完成 · 被击中',
        impact: 'player',
      }
      battleRef.current = nextBattle
      setBattle(nextBattle)
    }, 180)
    return () => window.clearInterval(interval)
  }, [battle.phase, entryStage, playSound, selectNextAction])

  useEffect(() => {
    if (!battle.impact) return
    const impactDuration = battle.impact === 'boss' && lastMove === 'wave-both' ? 1800 : 1150
    const timeout = window.setTimeout(() => {
      const nextBattle = { ...battleRef.current, impact: null }
      battleRef.current = nextBattle
      setBattle(nextBattle)
    }, impactDuration)
    return () => window.clearTimeout(timeout)
  }, [battle.impact, effectTick, lastMove])

  useEffect(() => {
    if (!phaseNotice) return
    const timeout = window.setTimeout(() => setPhaseNotice(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [phaseNotice])

  useEffect(() => {
    if (screen !== 'battle' || battle.phase !== 'playing' || entryStage) return
    playGesturePrompt(battle.target)
  }, [battle.phase, battle.target, entryStage, playGesturePrompt, screen])

  useEffect(() => {
    if (battle.phase === 'won') speakPrompt('胜利，训练完成')
    if (battle.phase === 'lost') speakPrompt('训练结束，休息一下')
  }, [battle.phase, speakPrompt])

  useEffect(() => {
    if (screen !== 'battle' || battle.phase !== 'playing' || entryStage) return
    let sequenceIndex = 0
    const interval = window.setInterval(() => {
      sequenceIndex = (sequenceIndex + 1) % BELIAL_SEQUENCE.length
      setBelialFrame(BELIAL_SEQUENCE[sequenceIndex])
    }, 650)
    return () => window.clearInterval(interval)
  }, [battle.phase, entryStage, screen])

  useEffect(() => {
    const projectileActive = battle.target === 'dodge-left' || battle.target === 'dodge-right'
    if (belialFrame !== 1 || projectileActive || screen !== 'battle' || battle.phase !== 'playing' || entryStage) return
    const now = performance.now()
    if (now - lastLaughRef.current < 6500) return
    lastLaughRef.current = now
    playEvilLaugh()
  }, [battle.phase, battle.target, belialFrame, entryStage, playEvilLaugh, screen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== 'battle' || battle.phase !== 'playing' || entryStage) return
      const map: Record<string, GestureId> = {
        x: 'guard',
        X: 'guard',
        ArrowLeft: 'dodge-left',
        ArrowRight: 'dodge-right',
        c: 'charge',
        C: 'charge',
        j: 'punch-left',
        J: 'punch-left',
        k: 'punch-right',
        K: 'punch-right',
        u: 'kick-left',
        U: 'kick-left',
        i: 'kick-right',
        I: 'kick-right',
        w: 'wave-both',
        W: 'wave-both',
        ' ': 'beam',
      }
      const gesture = map[event.key]
      if (gesture) {
        event.preventDefault()
        resolveGesture(gesture)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [battle.phase, entryStage, resolveGesture, screen])

  const togglePause = useCallback(() => {
    const current = battleRef.current
    let nextBattle = current
    if (current.phase === 'playing') {
      nextBattle = { ...current, phase: 'paused', message: '已暂停' }
    } else if (current.phase === 'paused') {
      actionDeadlineRef.current = performance.now() + 6800
      nextBattle = { ...current, phase: 'playing', message: '继续战斗' }
    }
    battleRef.current = nextBattle
    setBattle(nextBattle)
  }, [])

  const returnToSelect = useCallback(() => {
    pose.stop()
    promptAudioRef.current?.pause()
    speechRequestRef.current += 1
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current)
    window.speechSynthesis?.cancel()
    cameraBootRequestedRef.current = false
    setEntryStage(null)
    setLastTiming(null)
    setPhaseNotice(null)
    setScreen('select')
    battleRef.current = INITIAL_BATTLE
    setBattle(INITIAL_BATTLE)
    roundRef.current = 1
    setLastMove(null)
    setEffectTick(0)
    setBelialFrame(0)
  }, [pose.stop])

  const toggleMute = useCallback(() => {
    if (muted || !audioReady) {
      unlockAudio('声音已开启')
      return
    }
    setMuted((value) => {
      const next = !value
      if (next) {
        speechRequestRef.current += 1
        if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current)
        window.speechSynthesis?.cancel()
        promptAudioRef.current?.pause()
      }
      return next
    })
  }, [audioReady, muted, unlockAudio])

  const retry = useCallback(() => beginBattle(demo), [beginBattle, demo])
  const projectileSide = battle.target === 'dodge-right'
    ? 'left'
    : battle.target === 'dodge-left'
      ? 'right'
      : null
  const meteorIncoming = battle.target === 'wave-both'
  const tracking = getMotionTracking(pose.frame.landmarks)
  const activeBelialFrame = projectileSide === 'left'
    ? 2
    : projectileSide === 'right'
      ? 3
      : belialFrame
  const monsterStyle = {
    '--monster-x': `${tracking.monsterOffset}px`,
  } as CSSProperties

  if (screen === 'select') {
    return (
      <StartScreen
        loading={pose.status === 'loading'}
        cameraError={pose.error}
        muted={muted}
        audioReady={audioReady}
        bosses={BOSSES}
        selectedBossIndex={selectedBossIndex}
        onSelectBoss={setSelectedBossIndex}
        onSoundToggle={toggleMute}
        onStartCamera={startWithCamera}
        onStartDemo={startDemo}
      />
    )
  }

  return (
    <main className={`game-shell impact-${battle.impact ?? 'none'} move-${lastMove ?? 'none'}`}>
      <div key={`${scene}-${effectTick}`} className="battle-scene" style={{ backgroundImage: `url(${scene})` }} aria-label={`${hero.name} 对战 ${boss.name}`} />
      <div className="scene-vignette" aria-hidden="true" />
      <div className={`belial-actor belial-actor--${boss.id} belial-frame-${activeBelialFrame}`} style={monsterStyle} aria-hidden="true">
        <img key={`${boss.id}-${activeBelialFrame}`} src={`${boss.spritePrefix}-${activeBelialFrame}.png`} alt="" />
      </div>
      <HeroBackFigure className={`hero-full-body hero-full-body--${lastMove ?? 'idle'}`} label="战斗中的迪迦奥特曼背面" />
      <div className="arena-lines" aria-hidden="true"><i /><i /><i /><i /></div>
      {(projectileSide || meteorIncoming) && battle.phase === 'playing' ? (
        <div key={`projectile-${effectTick}`} className={`projectile-flight projectile-flight--${meteorIncoming ? 'meteor' : projectileSide}`} style={monsterStyle} aria-hidden="true">
          <img src={meteorIncoming ? '/assets/animation/meteor.png' : '/assets/belial-projectile.png'} alt="" />
        </div>
      ) : null}
      {meteorIncoming ? (
        <div className="incoming-warning incoming-warning--meteor" aria-live="assertive">
          <strong>陨石来袭</strong>
          <span>双手快速挥动 4 次击破</span>
        </div>
      ) : projectileSide ? (
        <div className={`incoming-warning incoming-warning--${projectileSide}`} aria-live="assertive">
          <strong>{projectileSide === 'left' ? '左侧来袭' : '右侧来袭'}</strong>
          <span>{projectileSide === 'left' ? '向右躲避' : '向左躲避'}</span>
        </div>
      ) : null}
      {battle.impact === 'boss' && lastMove === 'beam' ? <div key={`beam-${effectTick}`} className="beam-effect" aria-hidden="true" /> : null}
      {battle.impact === 'boss' && lastMove === 'finisher' ? (
        <div key={`finisher-${effectTick}`} className="finisher-effect" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      ) : null}
      {battle.impact === 'guard' ? <div key={`guard-${effectTick}`} className="guard-effect" aria-hidden="true" /> : null}
      {battle.impact === 'boss' && lastMove === 'charge' ? <div key={`charge-${effectTick}`} className="charge-effect" aria-hidden="true"><i /><i /><i /></div> : null}
      {battle.impact === 'boss' && (lastMove === 'dodge-left' || lastMove === 'dodge-right') ? (
        <div key={`dodge-${effectTick}`} className={`dodge-effect dodge-effect--${lastMove === 'dodge-left' ? 'left' : 'right'}`} aria-hidden="true"><i /><i /><i /></div>
      ) : null}
      {battle.impact === 'boss' && (lastMove === 'punch-left' || lastMove === 'punch-right') ? (
        <div key={`punch-${effectTick}`} className={`punch-effect punch-effect--${lastMove === 'punch-left' ? 'left' : 'right'}`} aria-hidden="true"><i /></div>
      ) : null}
      {battle.impact === 'boss' && (lastMove === 'kick-left' || lastMove === 'kick-right') ? (
        <div key={`kick-${effectTick}`} className={`kick-effect kick-effect--${lastMove === 'kick-left' ? 'left' : 'right'}`} aria-hidden="true"><i /></div>
      ) : null}
      {battle.impact === 'boss' && lastMove === 'wave-both' ? (
        <div key={`wave-${effectTick}`} className="wave-effect" aria-hidden="true"><i /><i /><i /><i /></div>
      ) : null}
      {battle.impact === 'boss' && lastMove === 'wave-both' ? (
        <div key={`meteor-break-${effectTick}`} className="meteor-break" aria-hidden="true">
          <b />
          <i /><i /><i /><i /><i /><i /><i /><i />
        </div>
      ) : null}
      {battle.impact ? (
        <div key={`action-${effectTick}`} className={`action-confirm ${battle.impact === 'player' ? 'is-danger' : ''}`} aria-live="assertive">
          {lastMove ? <GestureIcon gesture={lastMove} size={28} /> : null}
          <div>
            {lastTiming ? <span className={`timing-grade timing-grade--${lastTiming}`}>{lastTiming.toUpperCase()}</span> : null}
            <strong>{lastMove ? GESTURES[lastMove].label : '动作未完成 · 受到攻击'}</strong>
          </div>
        </div>
      ) : null}
      {phaseNotice ? (
        <div className="phase-notice" aria-live="assertive">
          <span>PHASE SHIFT</span>
          <strong>{phaseNotice}</strong>
        </div>
      ) : null}
      <div className="impact-flash" aria-hidden="true" />

      <GameHud
        hero={hero}
        boss={boss}
        playerHealth={battle.playerHealth}
        bossHealth={battle.bossHealth}
        bossMaxHealth={BOSS_MAX_HEALTH}
        bossPhase={battle.bossPhase}
        round={battle.round}
        timeLeft={battle.timeLeft}
        phase={battle.phase}
        muted={muted}
        cameraActive={!demo}
        onPause={togglePause}
        onMute={toggleMute}
      />

      <CameraFeed
        videoRef={pose.videoRef}
        canvasRef={pose.canvasRef}
        frame={pose.frame}
        status={pose.status}
        error={pose.error}
        demo={demo}
        entryStage={entryStage}
      />

      {entryStage ? (
        <EntryOverlay
          stage={entryStage}
          cameraActive={pose.status === 'active'}
          demo={demo}
          bossName={boss.name}
          bossSprite={`${boss.spritePrefix}-0.png`}
        />
      ) : null}

      <ActionPanel
        target={battle.target}
        energy={battle.energy}
        combo={battle.combo}
        score={battle.score}
        message={battle.message}
        demo={demo}
        finisherAvailable={battle.energy >= 100}
        onDemoGesture={resolveGesture}
        onFinisher={() => resolveGesture('finisher')}
      />

      {battle.phase === 'paused' ? (
        <section className="state-overlay" role="dialog" aria-modal="true" aria-label="游戏已暂停">
          <strong>战斗暂停</strong>
          <button className="primary-command" type="button" onClick={togglePause}>继续战斗</button>
          <button className="text-command" type="button" onClick={returnToSelect}><ArrowLeft />重新选择</button>
        </section>
      ) : null}

      {battle.phase === 'won' || battle.phase === 'lost' ? (
        <section className="state-overlay result-overlay" role="dialog" aria-modal="true" aria-label="战斗结果">
          <Trophy aria-hidden="true" />
          <span>{battle.phase === 'won' ? 'MISSION COMPLETE' : 'TRAINING COMPLETE'}</span>
          <strong>{battle.phase === 'won' ? '光之胜利' : '继续训练'}</strong>
          <div className="result-score"><small>最终得分</small><b>{battle.score}</b></div>
          <div className="result-actions">
            <button className="secondary-command" type="button" onClick={returnToSelect}><ArrowLeft />重新选择</button>
            <button className="primary-command" type="button" onClick={retry}><RefreshCcw />再次挑战</button>
          </div>
        </section>
      ) : null}
    </main>
  )
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export default App
