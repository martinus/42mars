;redcode-odd
;name L: Unsteady
;author John Metcalf
;strategy IRCT17
;assert 1

loop:mov   db, loop-30
     jmz.f @0, <loop

     mov.i #2, 2
     mov.i #2, 2
db:  end
