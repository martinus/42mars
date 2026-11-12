;redcode-94
;name 0 for 100
;author John K W
;strategy Lose points.  Break records. :-)
;assert 1

p: ldp.b #0, #0

sne.b p, #-1 ;die first round
dat 100, 200

seq.b p, #0
jmp 1
dat 100, 200
