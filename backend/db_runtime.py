"""Database work runs in worker threads; socket I/O stays on the ASGI loop.

Notifications are buffered until the outer database action has released its
transaction. A slow WebSocket must never extend a PostgreSQL row lock.
"""
import asyncio
import contextvars
import functools
import logging
from sqlalchemy.orm import Session

_events = contextvars.ContextVar('kyvien_db_events', default=None)
_loop = None
_deliver = None
_pending = set()
log = logging.getLogger('kyvien.runtime')


def configure(deliver):
    global _loop, _deliver
    _loop = asyncio.get_running_loop()
    _deliver = deliver


def notify(kind, *args):
    events = _events.get()
    if events is None:
        raise RuntimeError('Database notification must belong to a db_action')
    events.append((kind, args))


async def _send(events):
    for kind, args in events:
        try:
            await _deliver(kind, *args)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception('KV_RUNTIME notification_failed kind=%s', kind)


def _schedule(events):
    task = asyncio.create_task(_send(events))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


def db_action(fn):
    """Keep a synchronous callable, so FastAPI dispatches it to its threadpool.

    Nested adapters share one buffer. Business functions explicitly commit
    writes; any remaining read transaction is rolled back before notification.
    """
    @functools.wraps(fn)
    def run(*args, **kwargs):
        if _events.get() is not None:
            return fn(*args, **kwargs)
        events = []
        marker = _events.set(events)
        sessions = {id(value): value for value in (*args, *kwargs.values())
                    if isinstance(value, Session)}
        try:
            result = fn(*args, **kwargs)
            for session in sessions.values():
                if session.in_transaction():
                    session.rollback()
        except BaseException:
            for session in sessions.values():
                session.rollback()
            raise
        else:
            if events and _loop is not None and not _loop.is_closed():
                # Do not propagate this thread's event buffer to the ASGI task.
                _loop.call_soon_threadsafe(_schedule, events, context=contextvars.Context())
            return result
        finally:
            _events.reset(marker)
    return run


async def shutdown():
    tasks = list(_pending)
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
