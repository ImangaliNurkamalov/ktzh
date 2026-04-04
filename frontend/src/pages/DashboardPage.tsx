import {
  CabinSpeedCard,
  DashboardHeader,
  HealthScoreCard,
  TelemetryCardsGrid,
  TrackRoutePanel,
} from '../components/dashboard'
import { MOCK_DIESEL_LOCOMOTIVE_ID, MOCK_ELECTRIC_LOCOMOTIVE_ID } from '../mocks/sampleTelemetry'
import { useTelemetry } from '../telemetry'

export function DashboardPage() {
  const {
    connection,
    latestMessage,
    history,
    previousMessage,
    source,
    maxHistoryAgeSec,
    mockVariant,
    setMockVariant,
  } = useTelemetry()

  if (!latestMessage) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <p className="text-sm font-medium text-slate-400">Ожидание телеметрии…</p>
        <p className="max-w-md text-xs text-slate-500">
          {source === 'websocket'
            ? 'Подключите WebSocket (VITE_WS_URL). Сообщения hello / tick или сырой JSON локомотива.'
            : 'Инициализация mock-потока.'}
        </p>
      </div>
    )
  }

  const prev = previousMessage ?? latestMessage

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DashboardHeader
        trainId={latestMessage.locomotive_id}
        locomotiveType={latestMessage.type}
        connection={connection}
      />

      <main className="flex flex-1 flex-col gap-4" aria-label="Кабина">
        {source === 'mock' ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Выбор mock локомотива">
            <MockLocoButton
              active={mockVariant === 'diesel'}
              label={MOCK_DIESEL_LOCOMOTIVE_ID}
              onClick={() => setMockVariant('diesel')}
            />
            <MockLocoButton
              active={mockVariant === 'electric'}
              label={MOCK_ELECTRIC_LOCOMOTIVE_ID}
              onClick={() => setMockVariant('electric')}
            />
          </div>
        ) : null}

        {/*
          Верхний ярус: слева две отдельные карточки (здоровье + скорость), справа сетка метрик (~2/3).
        */}
        <section className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
          <div className="flex flex-col gap-4 lg:col-span-4 xl:col-span-4">
            <HealthScoreCard health={latestMessage.health} variant="focus" />
            <CabinSpeedCard
              actualKph={latestMessage.telemetry.common.speed_actual}
              targetKph={latestMessage.telemetry.common.speed_target}
            />
          </div>
          <div className="flex min-h-0 lg:col-span-8 xl:col-span-8">
            <TelemetryCardsGrid message={latestMessage} previousMessage={prev} />
          </div>
        </section>

        <TrackRoutePanel
          message={latestMessage}
          source={source}
          historyPoints={history.length}
          maxHistoryAgeMin={Math.round(maxHistoryAgeSec / 60)}
        />
      </main>
    </div>
  )
}

function MockLocoButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-cyan-600/60 bg-cyan-500/20 text-cyan-900 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200'
          : 'border-cabin-border bg-cabin-surface text-slate-600 hover:border-slate-400 dark:text-slate-400 dark:hover:border-slate-600'
      }`}
    >
      {label}
    </button>
  )
}
