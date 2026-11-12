;redcode-nano
;assert 1
;author hwm
;name a bone to pick
;strategy imp-spiral
ptr equ -2
step equ 3
x1 equ 38
mov.i  <     ptr, <     x1
mov.i  #    step, >    -15
spl.f  $     ptr, >     21 
spl.f  $   -step, >   x1-1 
mov.i  #      16, $      1

