import { memo, useEffect, useMemo, useRef, useState } from "react"

interface LastDigitStatisticsProps {
  lastDigit: number

  tickValue: number

  maxTicks?: number
}

interface RollingStatistics {
  percentages: number[]
}

function useRollingDigitStatistics(
  lastDigit: number,
  tickValue: number,
  maxTicks: number,
): RollingStatistics {
  const queueRef = useRef<number[]>([])

  const countsRef = useRef<number[]>(Array(10).fill(0))

  const [percentages, setPercentages] = useState<number[]>(Array(10).fill(0))

  useEffect(() => {
    if (!Number.isFinite(lastDigit) || lastDigit < 0 || lastDigit > 9) {
      return
    }

    const queue = queueRef.current

    const counts = countsRef.current

    queue.push(lastDigit)

    counts[lastDigit] += 1

    if (queue.length > maxTicks) {
      const removed = queue.shift()

      if (removed !== undefined) {
        counts[removed] = Math.max(0, counts[removed] - 1)
      }
    }

    const total = queue.length

    const next = counts.map((count) => (total > 0 ? (count / total) * 100 : 0))

    setPercentages((prev) => {
      let changed = false

      const merged = [...prev]

      for (let index = 0; index < 10; index++) {
        if (Math.abs(prev[index] - next[index]) > 0.0001) {
          merged[index] = next[index]

          changed = true
        }
      }

      return changed ? merged : prev
    })
  }, [lastDigit, tickValue, maxTicks])

  return { percentages }
}

function getPercentageColor(percentage: number) {
  if (percentage > 10.05) {
    return "#2CF9AE"
  }

  if (percentage < 9.95) {
    return "#FF5D7A"
  }

  return "#F8FAFC"
}

function arcLengthFromPercentage(percentage: number) {
  const normalized = Math.max(0, Math.min(1, percentage / 20))

  return Math.max(4, normalized * 100)
}

const PercentageLabel = memo(function PercentageLabel({
  percentage,
}: {
  percentage: number
}) {
  return (
    <span
      className="font-mono-data"
      style={{
        marginTop: 5,
        fontSize: 11,
        color: getPercentageColor(percentage),
        fontWeight: 600,
      }}
    >
      {percentage.toFixed(1)}%
    </span>
  )
})

const DigitCircle = memo(
  function DigitCircle({
    digit,
    percentage,
    isActive,
  }: {
    digit: number
    percentage: number
    isActive: boolean
  }) {
    const arcColor = getPercentageColor(percentage)

    const arcLength = arcLengthFromPercentage(percentage)

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minWidth: 32,
        }}
      >
        <div
          style={{
            width: 42,

            height: 42,

            borderRadius: "50%",

            position: "relative",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            fontFamily: "'IBM Plex Mono', monospace",

            fontSize: 18,

            fontWeight: 700,

            color: isActive ? "#0B111B" : "#F8FAFC",

            background: isActive ? "#FFFFFF" : "#0F1722",

            border: isActive
              ? "2px solid rgba(255,255,255,0.95)"
              : "1px solid rgba(148,163,184,0.28)",

            boxShadow: isActive
              ? "0 0 0 2px rgba(34,197,94,0.35)"
              : "inset 0 -3px 10px rgba(0,0,0,0.35)",

            overflow: "hidden",
          }}
        >
          <svg
            width="42"
            height="42"
            viewBox="0 0 42 42"
            style={{ position: "absolute", inset: 0 }}
          >
            <path
              d="M6 22 A15 15 0 0 1 36 22"
              fill="none"
              stroke="rgba(148,163,184,0.25)"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={100}
            />
            <path
              d="M6 22 A15 15 0 0 1 36 22"
              fill="none"
              stroke={arcColor}
              strokeWidth="2.4"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${arcLength} 100`}
              style={{
                transition:
                  "stroke-dasharray 380ms ease-in-out, stroke 380ms ease-in-out",
              }}
            />
          </svg>
          {digit}
        </div>
        <PercentageLabel percentage={percentage} />
      </div>
    )
  },
  (prev, next) => {
    return (
      prev.digit === next.digit &&
      prev.isActive === next.isActive &&
      Math.abs(prev.percentage - next.percentage) < 0.0001
    )
  },
)

export default function LastDigitStatistics({
  lastDigit,
  tickValue,
  maxTicks = 1000,
}: LastDigitStatisticsProps) {
  const { percentages } = useRollingDigitStatistics(
    lastDigit,
    tickValue,
    maxTicks,
  )

  const digits = useMemo(() => {
    return Array.from({ length: 10 }, (_, digit) => ({
      digit,

      percentage: percentages[digit],

      isActive: digit === lastDigit,
    }))
  }, [percentages, lastDigit])

  return (
    <div
      style={{
        margin: "0 8px 8px",
        background: "linear-gradient(180deg, #052116 0%, #061C13 100%)",
        border: "1px solid rgba(34,197,94,0.14)",
        borderRadius: 12,
        padding: "9px 10px 7px",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          minWidth: 420,
          flexWrap: "nowrap",
        }}
      >
        {digits.map((item) => (
          <DigitCircle
            key={item.digit}
            digit={item.digit}
            percentage={item.percentage}
            isActive={item.isActive}
          />
        ))}
      </div>
    </div>
  )
}
