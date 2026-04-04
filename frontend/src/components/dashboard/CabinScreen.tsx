import type { LocomotiveTelemetry } from '../../types'
import { CabinElectricalPanel } from './CabinElectricalPanel'
import { CabinFuelEnergyPanel } from './CabinFuelEnergyPanel'
import { CabinPressureTemperaturePanel } from './CabinPressureTemperaturePanel'
import { CabinSpeedPanel } from './CabinSpeedPanel'

interface CabinScreenProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
}

/**
 * Единый экран «Кабина»: телеметрия, разбитая по панелям ТЗ (скорость, топливо/энергия, давл./темп., электрика).
 */
export function CabinScreen({ message, previousMessage }: CabinScreenProps) {
  return (
    <section className="flex flex-col gap-4" aria-label="Кабина — телеметрия">
      <div className="grid gap-3 lg:grid-cols-2">
        <CabinSpeedPanel message={message} previousMessage={previousMessage} />
        <CabinFuelEnergyPanel message={message} previousMessage={previousMessage} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <CabinPressureTemperaturePanel message={message} previousMessage={previousMessage} />
        <CabinElectricalPanel message={message} previousMessage={previousMessage} />
      </div>
    </section>
  )
}
