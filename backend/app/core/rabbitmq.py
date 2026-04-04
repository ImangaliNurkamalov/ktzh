"""
Очередь RabbitMQ для телеметрии локомотива.

Если задан RABBITMQ_URL — WS/REST и симулятор кладут сырой JSON в очередь,
отдельная задача вызывает ту же обработку, что и раньше (_process_raw_packet).
Без URL — поведение как до внедрения очереди.
"""

from __future__ import annotations

import asyncio
import logging
import aio_pika
from aio_pika import DeliveryMode

from app.core.config import settings

logger = logging.getLogger("rabbitmq")

_connection: aio_pika.RobustConnection | None = None
_publish_channel: aio_pika.abc.AbstractChannel | None = None
_consumer_task: asyncio.Task[None] | None = None


def enabled() -> bool:
    return bool(settings.RABBITMQ_URL and settings.RABBITMQ_URL.strip())


def queue_name() -> str:
    return settings.RABBITMQ_TELEMETRY_QUEUE


async def startup() -> None:
    global _connection, _publish_channel
    if not enabled():
        logger.info("RabbitMQ отключён (RABBITMQ_URL не задан)")
        return
    _connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    _publish_channel = await _connection.channel()
    await _publish_channel.declare_queue(queue_name(), durable=True)
    logger.info("RabbitMQ: очередь %s объявлена", queue_name())


async def shutdown() -> None:
    global _connection, _publish_channel, _consumer_task
    if _consumer_task is not None:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
        _consumer_task = None
    if _publish_channel is not None:
        await _publish_channel.close()
        _publish_channel = None
    if _connection is not None:
        await _connection.close()
        _connection = None
        logger.info("RabbitMQ: соединения закрыты")


async def publish_telemetry_raw(raw: str) -> None:
    if not enabled() or _publish_channel is None:
        raise RuntimeError("RabbitMQ не инициализирован")
    qn = queue_name()
    body = raw.encode("utf-8")
    await _publish_channel.default_exchange.publish(
        aio_pika.Message(
            body=body,
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
        ),
        routing_key=qn,
    )
    logger.info(
        "Published to queue %s (%d bytes, default exchange, routing_key=%s)",
        qn,
        len(body),
        qn,
    )


async def _consume_loop() -> None:
    from app.api.telemetry import _process_raw_packet

    assert _connection is not None
    channel = await _connection.channel()
    await channel.set_qos(prefetch_count=settings.RABBITMQ_PREFETCH)
    q = await channel.declare_queue(queue_name(), durable=True)
    logger.info("RabbitMQ: consumer слушает %s", queue_name())
    async with q.iterator() as queue_iter:
        async for message in queue_iter:
            qn = queue_name()
            async with message.process(requeue=False):
                logger.info("Consumed from queue %s (delivery_tag=%s)", qn, message.delivery_tag)
                try:
                    raw = message.body.decode("utf-8")
                    await _process_raw_packet(raw)
                except Exception:
                    logger.exception("Ошибка обработки сообщения из очереди")
                # Выход из context manager message.process() без исключения → basic_ack в aio-pika
                logger.info(
                    "Acked message from queue %s (delivery_tag=%s)",
                    qn,
                    message.delivery_tag,
                )


def start_consumer() -> None:
    global _consumer_task
    if not enabled():
        return
    if _consumer_task is not None:
        return
    _consumer_task = asyncio.create_task(_consume_loop(), name="rabbitmq-telemetry-consumer")
