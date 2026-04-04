import { useMemo } from 'react'
import type { LocomotiveTelemetry } from '../../types'
import { isDieselTelemetry, isElectricTelemetry } from '../../types'
import {
  CABIN_AMBIENT_TEMP_ROWS,
  CABIN_BRAKE_PRESSURE_ROWS,
  CABIN_DIESEL_ENGINE_PT_ROWS,
  CABIN_ELECTRIC_CONVERTER_ROW,
  CABIN_ELECTRIC_TRANSFORMER_ROWS,
  previousForSameLoco,
} from './cabinMetricRows'
import type { TelemetryMetricRow } from './telemetryMetricShared'
import { TelemetryMetricCards } from './telemetryMetricShared'

interface CabinPressureTemperaturePanelProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
}

export function CabinPressureTemperaturePanel({ message, previousMessage }: CabinPressureTemperaturePanelProps) {
  const previous = previousForSameLoco(message, previousMessage)

  const rows: TelemetryMetricRow[] = useMemo(() => {
    const base = [...CABIN_BRAKE_PRESSURE_ROWS, ...CABIN_AMBIENT_TEMP_ROWS]
    if (isDieselTelemetry(message)) {
      return [...base, ...CABIN_DIESEL_ENGINE_PT_ROWS]
    }
    if (isElectricTelemetry(message)) {
      const tail = [...CABIN_ELECTRIC_TRANSFORMER_ROWS]
      if (message.telemetry.power_system.converter_temp !== undefined) {
        tail.push(CABIN_ELECTRIC_CONVERTER_ROW)
      }
      return [...base, ...tail]
    }
    return base
  }, [message])

  return (
    <TelemetryMetricCards
      sectionTitle="Давления и температуры"
      subtitle="тормоза · салон · силовая установка"
      rows={rows}
      current={message}
      previous={previous}
    />
  )
}
