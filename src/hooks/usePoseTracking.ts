import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { getMirroredBodyCenter, inferGesture, POSE_EDGES } from '../pose'
import type { GestureId, PoseFrame, PoseStatus } from '../types'

const EMPTY_FRAME: PoseFrame = {
  landmarks: null,
  gesture: null,
  confidence: 0,
  detected: false,
  calibrated: false,
}

const drawPose = (
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[] | null,
) => {
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!landmarks) return

  const point = (index: number) => ({
    x: canvas.width - landmarks[index].x * canvas.width,
    y: landmarks[index].y * canvas.height,
    visible: (landmarks[index].visibility ?? 1) > 0.45,
  })

  context.lineWidth = Math.max(3, canvas.width / 160)
  context.lineCap = 'round'
  context.shadowBlur = 12
  context.shadowColor = '#00ddea'
  context.strokeStyle = 'rgba(67, 235, 239, 0.92)'

  for (const [from, to] of POSE_EDGES) {
    const start = point(from)
    const end = point(to)
    if (!start.visible || !end.visible) continue
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()
  }

  for (const index of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const current = point(index)
    if (!current.visible) continue
    context.beginPath()
    context.fillStyle = index === 15 || index === 16 ? '#f5c34b' : '#f4fbff'
    context.arc(current.x, current.y, Math.max(4, canvas.width / 110), 0, Math.PI * 2)
    context.fill()
  }

  context.shadowBlur = 0
}

export const usePoseTracking = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const animationRef = useRef<number | null>(null)
  const calibrationSamples = useRef<number[]>([])
  const baselineRef = useRef(0.5)
  const previousLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const candidateGestureRef = useRef<GestureId | null>(null)
  const candidateSinceRef = useRef(0)
  const waveBurstCountRef = useRef(0)
  const waveLastBurstRef = useRef(0)
  const lastVideoTime = useRef(-1)
  const [frame, setFrame] = useState<PoseFrame>(EMPTY_FRAME)
  const [status, setStatus] = useState<PoseStatus>('idle')
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    animationRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    calibrationSamples.current = []
    previousLandmarksRef.current = null
    candidateGestureRef.current = null
    candidateSinceRef.current = 0
    waveBurstCountRef.current = 0
    waveLastBurstRef.current = 0
    setFrame(EMPTY_FRAME)
    setStatus('idle')
  }, [])

  const runDetection = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker) return

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime
      const result = landmarker.detectForVideo(video, performance.now())
      const landmarks = result.landmarks[0] ?? null

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      drawPose(canvas, landmarks)

      if (landmarks) {
        if (calibrationSamples.current.length < 24) {
          calibrationSamples.current.push(getMirroredBodyCenter(landmarks))
          baselineRef.current =
            calibrationSamples.current.reduce((sum, value) => sum + value, 0) /
            calibrationSamples.current.length
        }
        const calibrated = calibrationSamples.current.length >= 12
        const prediction = calibrated
          ? inferGesture(landmarks, baselineRef.current, previousLandmarksRef.current)
          : { gesture: null, confidence: 0 }
        const now = performance.now()
        if (prediction.gesture === 'wave-both') {
          if (now - waveLastBurstRef.current > 150) waveBurstCountRef.current += 1
          waveLastBurstRef.current = now
        } else if (waveBurstCountRef.current > 0 && now - waveLastBurstRef.current > 700) {
          waveBurstCountRef.current = 0
        }
        if (prediction.gesture !== candidateGestureRef.current) {
          candidateGestureRef.current = prediction.gesture
          candidateSinceRef.current = now
        }
        const requiredHold = prediction.gesture === 'beam' ? 550 : prediction.gesture === 'charge' ? 240 : 0
        const waveReady = prediction.gesture !== 'wave-both' || waveBurstCountRef.current >= 4
        const stableGesture = prediction.gesture && waveReady && now - candidateSinceRef.current >= requiredHold
          ? prediction.gesture
          : null
        if (stableGesture === 'wave-both') {
          waveBurstCountRef.current = 0
          waveLastBurstRef.current = now
          candidateGestureRef.current = null
          candidateSinceRef.current = now
        }
        previousLandmarksRef.current = landmarks.map((point) => ({ ...point }))
        setFrame({
          landmarks,
          gesture: stableGesture,
          confidence: prediction.confidence,
          detected: true,
          calibrated,
        })
      } else {
        previousLandmarksRef.current = null
        candidateGestureRef.current = null
        candidateSinceRef.current = 0
        waveBurstCountRef.current = 0
        waveLastBurstRef.current = 0
        setFrame((current) => ({ ...current, landmarks: null, gesture: null, detected: false }))
      }
    }

    animationRef.current = requestAnimationFrame(runDetection)
  }, [])

  const createLandmarker = useCallback(async () => {
    const vision = await FilesetResolver.forVisionTasks('/vision/wasm')
    const options = {
      baseOptions: {
        modelAssetPath: '/vision/pose_landmarker_lite.task',
        delegate: 'GPU' as const,
      },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }

    try {
      return await PoseLandmarker.createFromOptions(vision, options)
    } catch {
      return PoseLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          modelAssetPath: '/vision/pose_landmarker_lite.task',
          delegate: 'CPU' as const,
        },
      })
    }
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('当前浏览器无法使用摄像头')
      return false
    }

    setStatus('loading')
    setError('')
    calibrationSamples.current = []
    previousLandmarksRef.current = null
    candidateGestureRef.current = null
    candidateSinceRef.current = 0
    waveBurstCountRef.current = 0
    waveLastBurstRef.current = 0
    lastVideoTime.current = -1

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const landmarker = await createLandmarker()
      landmarkerRef.current = landmarker
      setStatus('active')
      animationRef.current = requestAnimationFrame(runDetection)
      return true
    } catch (cause) {
      const denied = cause instanceof DOMException && cause.name === 'NotAllowedError'
      setStatus(denied ? 'denied' : 'error')
      setError(denied ? '摄像头权限未开启' : '姿态识别启动失败')
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      return false
    }
  }, [createLandmarker, runDetection])

  useEffect(() => stop, [stop])

  return {
    videoRef,
    canvasRef,
    frame,
    status,
    error,
    start,
    stop,
  }
}
