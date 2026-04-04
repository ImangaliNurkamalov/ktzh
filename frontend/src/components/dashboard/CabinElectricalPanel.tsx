import type { LocomotiveTelemetry } from '../../types'
import { isElectricTelemetry } from '../../types'
import { CABIN_BOARD_VOLTAGE_ROWS, previousForSameLoco } from './cabinMetricRows'
import { TelemetryMetricCards } from './telemetryMetricShared'

interface CabinElectricalPanelProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
}

export function CabinElectricalPanel({ message, previousMessage }: CabinElectricalPanelProps) {
  const previous = previousForSameLoco(message, previousMessage)
  const ps = isElectricTelemetry(message) ? message.telemetry.power_system : null

  return (
    <div className="space-y-3">
      <TelemetryMetricCards
        sectionTitle="Электрика"
        subtitle="бортсеть"
        rows={CABIN_BOARD_VOLTAGE_ROWS}
        current={message}
        previous={previous}
      />
      {ps ? (
        <div className="rounded-xl border border-cabin-border bg-cabin-surface px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Токоприемник</p>
          <p className="mt-1 font-mono text-sm capitalize text-slate-800 dark:text-slate-200">
            {String(ps.pantograph_status)}
          </p>
        </div>
      ) : null}
    </div>
  )
}
