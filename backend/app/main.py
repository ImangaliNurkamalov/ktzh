import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.api import dashboard, history, telemetry
from app.db.database import init_db
from app.services.simulator import run_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    sim_task = asyncio.create_task(run_simulator())
    yield
    sim_task.cancel()


app = FastAPI(
    title="Locomotive Digital Twin",
    version="0.1.0",
    description="MVP backend для цифрового двойника локомотива (TE33A / KZ8A)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router)
app.include_router(dashboard.router)
app.include_router(history.router)


HTML_PAGE = """\
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>KZ8A-0021 — Цифровой двойник</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;
  --muted:#8b949e;--green:#3fb950;--yellow:#d29922;--red:#f85149;
  --blue:#58a6ff;--cyan:#39d2c0;
  font-family:'Inter',system-ui,-apple-system,sans-serif;
  font-size:14px;color:var(--text);background:var(--bg);
}
body{padding:1rem 1.5rem;min-height:100vh}

.top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
.top-bar h1{font-size:1.1rem;font-weight:600;letter-spacing:.02em}
.conn{font-size:.75rem;padding:.25rem .6rem;border-radius:10px;font-weight:500}
.conn.ok{background:#0d3117;color:var(--green)}
.conn.err{background:#3d1418;color:var(--red)}
.conn.wait{background:#2a1f05;color:var(--yellow)}

.grid{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}

.card{
  background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:1rem;display:flex;flex-direction:column;gap:.5rem;
  transition:border-color .2s;
}
.card:hover{border-color:var(--muted)}
.card-title{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}

.big-value{font-size:2rem;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.unit{font-size:.75rem;color:var(--muted);margin-left:.25rem;font-weight:400}
.sub{font-size:.75rem;color:var(--muted);font-variant-numeric:tabular-nums}

.health-badge{
  display:inline-flex;align-items:center;gap:.4rem;
  padding:.2rem .7rem;border-radius:8px;font-size:.75rem;font-weight:600;
}
.health-badge.norm{background:#0d3117;color:var(--green)}
.health-badge.warning{background:#2a1f05;color:var(--yellow)}
.health-badge.critical{background:#3d1418;color:var(--red)}

.param-row{display:flex;justify-content:space-between;align-items:baseline;padding:.15rem 0}
.param-label{font-size:.75rem;color:var(--muted)}
.param-val{font-size:.85rem;font-weight:600;font-variant-numeric:tabular-nums}
.param-val .st{font-size:.6rem;margin-left:.2rem;padding:.1rem .3rem;border-radius:4px;font-weight:700}
.st.s0{color:var(--green);background:#0d3117}
.st.s1{color:var(--yellow);background:#2a1f05}
.st.s2{color:var(--red);background:#3d1418}

.route-bar{display:flex;gap:.5rem;align-items:center;font-size:.8rem}
.route-dot{width:8px;height:8px;border-radius:50%;background:var(--cyan);flex-shrink:0}
.route-line{flex:1;height:2px;background:var(--border);position:relative}
.route-line .fill{height:100%;background:var(--cyan);border-radius:1px;transition:width .8s ease}

.json-block{
  grid-column:1/-1;background:var(--card);border:1px solid var(--border);
  border-radius:10px;padding:1rem;max-height:22rem;overflow:auto;
}
.json-block pre{font-size:.7rem;line-height:1.45;color:var(--muted);white-space:pre-wrap;word-break:break-all}
</style>
</head>
<body>

<div class="top-bar">
  <h1>🚂 Цифровой двойник локомотива</h1>
  <span id="conn" class="conn wait">Подключение…</span>
</div>

<div class="grid">
  <div class="card" id="c-health">
    <div class="card-title">Индекс здоровья</div>
    <div><span class="big-value" id="v-health">—</span><span class="unit">/ 100</span></div>
    <div><span class="health-badge" id="v-status">—</span></div>
  </div>

  <div class="card">
    <div class="card-title">Скорость</div>
    <div><span class="big-value" id="v-speed">—</span><span class="unit">км/ч</span></div>
    <div class="sub">Целевая: <span id="v-speed-t">—</span> км/ч</div>
  </div>

  <div class="card">
    <div class="card-title">Тяговое усилие</div>
    <div><span class="big-value" id="v-traction">—</span><span class="unit">кН</span></div>
    <div class="sub">Пробуксовка: <span id="v-slip">—</span></div>
  </div>

  <div class="card">
    <div class="card-title">Маршрут</div>
    <div class="route-bar">
      <div class="route-dot"></div>
      <div class="route-line"><div class="fill" id="v-route-fill"></div></div>
      <span id="v-next-point" style="font-weight:600">—</span>
      <span style="color:var(--muted)">→</span>
      <span id="v-end-point">—</span>
    </div>
    <div class="sub">До ст.: <span id="v-dist-next">—</span> км · ETA <span id="v-eta">—</span> мин</div>
    <div class="sub">Осталось всего: <span id="v-dist-total">—</span> км</div>
  </div>

  <div class="card">
    <div class="card-title">Тормоза (атм)</div>
    <div class="param-row"><span class="param-label">ТМ</span><span class="param-val" id="v-tm">—</span></div>
    <div class="param-row"><span class="param-label">ГР</span><span class="param-val" id="v-gr">—</span></div>
    <div class="param-row"><span class="param-label">ТЦ</span><span class="param-val" id="v-tc">—</span></div>
  </div>

  <div class="card">
    <div class="card-title">Температуры (°C)</div>
    <div class="param-row"><span class="param-label">Подшипники max</span><span class="param-val" id="v-bear">—</span></div>
    <div class="param-row"><span class="param-label">Кабина</span><span class="param-val" id="v-cabin">—</span></div>
  </div>

  <div class="card">
    <div class="card-title">Электрика</div>
    <div class="param-row"><span class="param-label">Борт. напряжение</span><span class="param-val" id="v-bv">—</span></div>
    <div class="param-row"><span class="param-label">Контактная сеть</span><span class="param-val" id="v-cat">—</span></div>
    <div class="param-row"><span class="param-label">Ток тяги</span><span class="param-val" id="v-cur">—</span></div>
    <div class="param-row"><span class="param-label">Т трансф.</span><span class="param-val" id="v-trf">—</span></div>
    <div class="param-row"><span class="param-label">Пантограф</span><span class="param-val" id="v-panto">—</span></div>
  </div>

  <div class="card">
    <div class="card-title">Локомотив</div>
    <div class="param-row"><span class="param-label">ID</span><span class="param-val" id="v-id">—</span></div>
    <div class="param-row"><span class="param-label">Тип</span><span class="param-val" id="v-type">—</span></div>
  </div>

  <div class="json-block">
    <div class="card-title" style="margin-bottom:.5rem">RAW JSON</div>
    <pre id="v-json">Ожидание данных…</pre>
  </div>
</div>

<script>
const $ = id => document.getElementById(id);

function ch(v, digits=1) {
  if (typeof v === 'object' && v !== null && 'value' in v) {
    const n = typeof v.value === 'number' ? v.value.toFixed(digits) : v.value;
    const s = v.state || 0;
    const cls = s === 0 ? 's0' : s === 1 ? 's1' : 's2';
    return n + '<span class="st ' + cls + '">S' + s + '</span>';
  }
  return typeof v === 'number' ? v.toFixed(digits) : String(v);
}

function render(d) {
  const h = d.health || {};
  const r = d.route_map || {};
  const c = (d.telemetry || {}).common || {};
  const p = (d.telemetry || {}).power_system || {};
  const br = c.brakes || {};
  const tm = c.temperatures || {};

  $('v-id').textContent = d.locomotive_id || '—';
  $('v-type').textContent = d.type || '—';

  $('v-health').textContent = h.index ?? '—';
  const badge = $('v-status');
  badge.textContent = h.status === 'norm' ? 'Норма' : h.status === 'warning' ? 'Внимание' : h.status === 'critical' ? 'Критично' : '—';
  badge.className = 'health-badge ' + (h.status || '');

  $('v-speed').textContent = c.speed_actual ? c.speed_actual.value.toFixed(1) : '—';
  $('v-speed-t').textContent = c.speed_target ? c.speed_target.value.toFixed(1) : '—';
  $('v-traction').textContent = c.traction_force_kn ? c.traction_force_kn.value.toFixed(0) : '—';
  $('v-slip').textContent = c.wheel_slip ? (c.wheel_slip.value ? 'Да ⚠' : 'Нет') : '—';

  $('v-next-point').textContent = r.next_point || '—';
  $('v-end-point').textContent = r.end_point || '—';
  $('v-dist-next').textContent = r.distance_to_next_km ?? '—';
  $('v-eta').textContent = r.eta_next_minutes ?? '—';
  $('v-dist-total').textContent = r.total_distance_left_km ?? '—';

  const totalInit = 350;
  const left = r.total_distance_left_km || totalInit;
  const pct = Math.max(0, Math.min(100, ((totalInit - left) / totalInit) * 100));
  $('v-route-fill').style.width = pct + '%';

  $('v-tm').innerHTML = ch(br.tm_pressure, 2);
  $('v-gr').innerHTML = ch(br.gr_pressure, 2);
  $('v-tc').innerHTML = ch(br.tc_pressure, 2);

  $('v-bear').innerHTML = ch(tm.bearings_max, 1);
  $('v-cabin').innerHTML = ch(tm.cabin, 1);

  $('v-bv').innerHTML = ch(c.board_voltage, 1);
  $('v-cat').innerHTML = p.catenary_voltage_kv ? ch(p.catenary_voltage_kv, 1) + ' кВ' : '—';
  $('v-cur').innerHTML = p.traction_current_a ? ch(p.traction_current_a, 0) + ' А' : '—';
  $('v-trf').innerHTML = p.transformer_temp ? ch(p.transformer_temp, 1) + ' °C' : '—';
  $('v-panto').textContent = p.pantograph_status ? p.pantograph_status.value : '—';

  $('v-json').textContent = JSON.stringify(d, null, 2);
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws/dashboard');

  ws.onopen = () => {
    $('conn').textContent = 'Подключено';
    $('conn').className = 'conn ok';
  };
  ws.onmessage = (ev) => {
    try { render(JSON.parse(ev.data)); } catch {}
  };
  ws.onerror = () => {
    $('conn').textContent = 'Ошибка';
    $('conn').className = 'conn err';
  };
  ws.onclose = () => {
    $('conn').textContent = 'Переподключение…';
    $('conn').className = 'conn wait';
    setTimeout(connect, 2000);
  };
}

connect();
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse, tags=["ui"])
async def index():
    return HTMLResponse(HTML_PAGE)


@app.get("/health", tags=["system"])
async def healthcheck():
    return {"status": "ok"}
