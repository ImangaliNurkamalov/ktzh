import type { LocomotiveTelemetry } from '../../types'
import { CABIN_SPEED_ROWS, previousForSameLoco } from './cabinMetricRows'
import { TelemetryMetricCards } from './telemetryMetricShared'

interface CabinSpeedPanelProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
}

export function CabinSpeedPanel({ message, previousMessage }: CabinSpeedPanelProps) {
  const previous = previousForSameLoco(message, previousMessage)
  return (
    <TelemetryMetricCards
      sectionTitle="Скорость"
      subtitle="telemetry.common — движение"
      rows={CABIN_SPEED_ROWS}
      current={message}
      previous={previous}
    />
  )
}
