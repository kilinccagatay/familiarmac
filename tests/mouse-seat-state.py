import sys, threading, time, unittest
from pathlib import Path
sys.path.insert(0,str(Path('native/mouse-shortcuts').resolve()))
from seat_state import SeatState

class SeatTests(unittest.TestCase):
    def test_fresh_lock_loss_and_stale_reply(self):
        now=[10.0];answer=[1000]
        def query():return answer[0]
        seat=SeatState(query,clock=lambda:now[0])
        self.assertIsNone(seat.current())
        seat.refresh();self.assertEqual(seat.current(),1000)
        answer[0]=None;seat.refresh();self.assertIsNone(seat.current())
        answer[0]=1001;seat.refresh();self.assertEqual(seat.current(),1001)
        now[0]+=1;self.assertIsNone(seat.current())
        def delayed():now[0]+=2;return 1000
        seat.query=delayed;seat.refresh();self.assertIsNone(seat.current())
        def failure():raise OSError('logind unavailable')
        seat.query=failure;seat.refresh();self.assertIsNone(seat.current())
        seat.close()

    def test_slow_query_never_blocks_input_or_shutdown(self):
        waiting=threading.Event();unblock=threading.Event();fresh=threading.Event()
        ids=[]
        def query():
            ids.append(threading.get_ident())
            if len(ids)==1:fresh.set();return 1000
            waiting.set();unblock.wait(2);return 1000
        seat=SeatState(query,interval=.005,max_age=.03)
        try:
            seat.start();self.assertTrue(fresh.wait(1));self.assertTrue(waiting.wait(1))
            started=time.monotonic()
            # These are input-loop reads while the control worker is blocked.
            for _ in range(1000):seat.current()
            self.assertLess(time.monotonic()-started,.1)
            self.assertTrue(all(i!=threading.get_ident() for i in ids))
            time.sleep(.04);self.assertIsNone(seat.current())
            started=time.monotonic();seat.close()
            self.assertLess(time.monotonic()-started,.1)
            unblock.set();seat._thread.join(1)
            self.assertIsNone(seat.current(),'Late reply must not restore a closed monitor')
        finally:
            seat.close();unblock.set();seat._thread.join(1)

unittest.main()
