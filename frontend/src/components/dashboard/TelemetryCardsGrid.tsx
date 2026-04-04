import type { LocomotiveTelemetry } from '../../types'
import { CabinKeyMetricsGrid } from './CabinKeyMetricsGrid'

interface TelemetryCardsGridProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
}

/** Полная сетка метрик кабины рядом с индексом здоровья (растягивается по высоте колонки). */
export function TelemetryCardsGrid({ message, previousMessage }: TelemetryCardsGridProps) {
  return (
    <div className="h-full min-h-0 w-full">
      <CabinKeyMetricsGrid message={message} previousMessage={previousMessage} />
    </div>
  )
}
