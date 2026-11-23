import type { RefObject } from 'react'
import { Activity, ScanLine, UserRound } from 'lucide-react'
import { GESTURES } from '../gameData'
import type { PoseFrame, PoseStatus } from '../types'

interface CameraFeedProps {
  videoRef: RefObject<HTMLVideoElement>
  canvasRef: RefObject<HTMLCanvasElement>
  frame: PoseFrame
  status: PoseStatus
  error: string
  demo: boolean
  entryStage?: 'camera' | 'fusion' | 'hero-arrival' | 'monster-arrival' | null
}

export function CameraFeed({ videoRef, canvasRef, frame, status, error, demo, entryStage = null }: CameraFeedProps) {
  const cameraEntryStage = entryStage === 'camera' || entryStage === 'fusion'
  const arrivalStage = entryStage === 'hero-arrival' || entryStage === 'monster-arrival'
  const label = demo
    ? '体验模式'
    : status === 'loading'
      ? '正在连接摄像头'
      : status === 'denied' || status === 'error'
        ? error || '摄像头连接失败'
        : frame.gesture
          ? `识别：${GESTURES[frame.gesture].label}`
          : !frame.detected
            ? '请站到镜头前'
            : frame.calibrated
              ? '姿态锁定'
              : '正在校准'

  return (
    <aside className={`camera-feed ${frame.detected || status === 'active' || demo ? 'is-active' : ''} ${cameraEntryStage ? `is-entry is-entry-${entryStage}` : ''} ${arrivalStage ? 'is-arrival' : ''}`} aria-label="体感识别画面">
      <div className="camera-feed__view">
        {demo ? (
          <div className="demo-silhouette" aria-hidden="true">
            <UserRound />
            <ScanLine />
          </div>
        ) : null}
        <video ref={videoRef} className={demo ? 'is-hidden' : ''} autoPlay muted playsInline />
        <canvas ref={canvasRef} className={demo ? 'is-hidden' : ''} />
        <span className="viewfinder viewfinder--tl" />
        <span className="viewfinder viewfinder--tr" />
        <span className="viewfinder viewfinder--bl" />
        <span className="viewfinder viewfinder--br" />
      </div>
      <div className="camera-feed__status">
        <Activity aria-hidden="true" />
        <span>{label}</span>
        <i />
      </div>
    </aside>
  )
}
