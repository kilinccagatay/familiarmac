#!/usr/bin/env python3
"""Check analytic coverage and conservative opaque cross used by prototype."""
import math
import unittest

def coverage(x,y,w,h,r,n):
    if not (0<=x<=w and 0<=y<=h):return 0
    if r<=0:return 1
    if r<=x<=w-r or r<=y<=h-r:return 1
    cx=min(max(x,r),w-r);cy=min(max(y,r),h-r)
    d=(abs(x-cx)**n+abs(y-cy)**n)**(1/n)
    return max(0,min(1,r-d+.5))

class Geometry(unittest.TestCase):
    def test_symmetry_and_opaque_region(self):
        for w,h in [(820,500),(200,120),(48,48)]:
            for n in [2,4,8,12]:
                r=min(24,w/2,h/2);ri=math.ceil(r+1)
                for x in range(w+1):
                    for y in range(0,h+1,5):
                        a=coverage(x,y,w,h,r,n)
                        self.assertAlmostEqual(a,coverage(w-x,h-y,w,h,r,n))
                        if ri<=x<=w-ri or ri<=y<=h-ri:self.assertEqual(a,1)
                self.assertEqual(coverage(0,0,w,h,r,n),0)
    def test_fast_exponent(self):
        for x in range(48):
            for y in range(48):
                self.assertAlmostEqual(math.sqrt(math.sqrt(x**4+y**4)),(x**4+y**4)**.25)
    def test_disabled(self):
        self.assertEqual(coverage(0,0,20,20,0,4),1)

if __name__=='__main__':unittest.main()
