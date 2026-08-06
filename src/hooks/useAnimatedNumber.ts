import { useEffect, useMemo, useRef, useState } from 'react'

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function useAnimatedNumber(target: number, durationMs = 320) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(target)) {
      return
    }

    const start = performance.now()
    const initial = fromRef.current
    const delta = target - initial

    if (Math.abs(delta) < 0.01) {
      fromRef.current = target
      setValue(target)
      return
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = easeOutCubic(progress)
      const next = initial + delta * eased
      setValue(next)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [durationMs, target])

  return useMemo(() => Math.round(value * 100) / 100, [value])
}
