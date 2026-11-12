;assert 1
;name Azymuth
;author Miz
;strategy lines 27 - 33 used, +2 dat & 1 nop
;strategy oversized clear
g dat 0,0
  dat 0,0
a mov.i -1, <g
  mov.i -2, <g
  nop <g, {g
  sub.a #1, <g
  mov.i 3, <g
  mov.i 2, <g
  jmz.b -6, g+1
end a
