# Locomotive Digital Twin — Backend

MVP backend для цифрового двойника локомотивов **TE33A** (diesel) и **KZ8A** (electric).

## Стек

- Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL, WebSocket

## Быстрый старт

```bash
# 1. Создать БД
createdb locomotive_twin

# 2. Установить зависимости
cd backend
pip install -r requirements.txt

# 3. Запустить (таблицы создадутся автоматически при старте)
uvicorn app.main:app --reload
```

Swagger UI: http://localhost:8000/docs

## Примеры curl

### Diesel (TE33A)

```bash
curl -X POST http://localhost:8000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-04-04T12:00:00Z",
    "locomotive_id": "TE33A-0012",
    "type": "diesel",
    "telemetry": {
      "common": {
        "speed_actual": 75.4,
        "speed_target": 80.0,
        "traction_force_kn": 320,
        "wheel_slip": false,
        "coordinates": { "lat": 51.169392, "lng": 71.449074 },
        "brakes": { "tm_pressure": 4.8, "gr_pressure": 8.5, "tc_pressure": 1.2 },
        "temperatures": { "bearings_max": 65.2, "cabin": 22.0 },
        "board_voltage": 110
      },
      "power_system": {
        "diesel_rpm": 1050,
        "fuel_level_percent": 62,
        "fuel_consumption_lh": 180,
        "oil_pressure": 4.2,
        "oil_temp": 78,
        "coolant_temp": 82
      }
    },
    "alerts": []
  }'
```

### Electric (KZ8A)

```bash
curl -X POST http://localhost:8000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-04-04T12:00:00Z",
    "locomotive_id": "KZ8A-0045",
    "type": "electric",
    "telemetry": {
      "common": {
        "speed_actual": 90.0,
        "speed_target": 95.0,
        "traction_force_kn": 410,
        "wheel_slip": false,
        "coordinates": { "lat": 43.238949, "lng": 76.945526 },
        "brakes": { "tm_pressure": 5.1, "gr_pressure": 8.8, "tc_pressure": 1.5 },
        "temperatures": { "bearings_max": 58.3, "cabin": 24.0 },
        "board_voltage": 112
      },
      "power_system": {
        "catenary_voltage_kv": 25.3,
        "pantograph_status": "raised",
        "traction_current_a": 520,
        "transformer_temp": 72
      }
    },
    "alerts": [
      { "id": "W001", "level": "warning", "message": "Повышенная вибрация", "value": 3.2 }
    ]
  }'
```

### Получить текущий dashboard

```bash
curl http://localhost:8000/api/dashboard/current
```

### Получить историю

```bash
# Все локомотивы
curl http://localhost:8000/api/history

# Конкретный локомотив
curl "http://localhost:8000/api/history?locomotive_id=TE33A-0012&limit=10"
```

### WebSocket

```bash
# С помощью websocat
websocat ws://localhost:8000/ws/dashboard
```

Или откройте Swagger UI → `/docs` и используйте встроенный интерфейс.
