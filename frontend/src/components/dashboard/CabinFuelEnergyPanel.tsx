import type { LocomotiveTelemetry } from '../../types'
import { isDieselTelemetry, isElectricTelemetry } from '../../types'
import {
  CABIN_DIESEL_FUEL_ENERGY_ROWS,
  CABIN_ELECTRIC_ENERGY_ROWS,
  previousForSameLoco,
} from './cabinMetricRows'
import { TelemetryMetricCards } from './telemetryMetricShared'

interface CabinFuelEnergyPanelProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
}

export function CabinFuelEnergyPanel({ message, previousMessage }: CabinFuelEnergyPanelProps) {
  const previous = previousForSameLoco(message, previousMessage)

  if (isDieselTelemetry(message)) {
    return (
      <TelemetryMetricCards
        sectionTitle="Топливо и энергия"
        subtitle="ТЭ33А · дизель"
        rows={CABIN_DIESEL_FUEL_ENERGY_ROWS}
        current={message}
        previous={previous}
      />
    )
  }

  if (isElectricTelemetry(message)) {
    return (
      <TelemetryMetricCards
        sectionTitle="Топливо и энергия"
        subtitle="KZ8A · контактная сеть / тяга"
        rows={CABIN_ELECTRIC_ENERGY_ROWS}
        current={message}
        previous={previous}
      />
    )
  }

  return null
}
