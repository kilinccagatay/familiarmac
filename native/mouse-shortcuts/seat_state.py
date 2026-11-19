"""Keep slow logind queries off the exclusively grabbed pointer's input loop."""
import threading
import time


class SeatState:
    def __init__(self, query, *, clock=time.monotonic, interval=.25, max_age=1.0):
        self.query = query
        self.clock = clock
        self.interval = interval
        self.max_age = max_age
        self._sample = (None, float('-inf'))
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name='mouse-seat-state', daemon=True)

    def start(self):
        self._thread.start()

    def refresh(self):
        # Age from the start of the query, not its completion: a delayed reply
        # must never renew permission to intercept input using stale seat data.
        started = self.clock()
        try:
            uid = self.query()
        except Exception:
            uid = None
        if not self._stop.is_set():
            self._sample = (uid, started)

    def current(self):
        uid, started = self._sample
        age = self.clock() - started
        return uid if not self._stop.is_set() and 0 <= age < self.max_age else None

    def _run(self):
        while not self._stop.is_set():
            self.refresh()
            self._stop.wait(self.interval)

    def close(self):
        # Never join a worker blocked in D-Bus while the pointer is grabbed.
        self._stop.set()
        self._sample = (None, float('-inf'))
