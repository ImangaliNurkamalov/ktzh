export type { ConnectionStatus } from './connection'

export type {
  AlertLevel,
  CommonTelemetry,
  DieselLocomotiveTelemetry,
  DieselPowerSystem,
  ElectricLocomotiveTelemetry,
  ElectricPowerSystem,
  HealthStatus,
  HealthTopFactor,
  LocomotiveAlert,
  LocomotiveHealth,
  LocomotiveHelloMessage,
  LocomotiveTelemetry,
  LocomotiveTickMessage,
  LocomotiveType,
  LocomotiveWsMessage,
  PantographStatus,
  RouteMap,
  SensorStatesMap,
  TelemetryBrakes,
  TelemetryCoordinates,
  TelemetrySensorState,
  TelemetryTemperatures,
} from './locomotiveTelemetry'

export { isDieselTelemetry, isElectricTelemetry } from './locomotiveTelemetry'
