;redcode-nano
;assert CORESIZE==80
;author hwm
;name returning home
;strategy cmp scanner

step equ 39

boot mov.i  >  -step+1, $        16
     mov.i  >     step, $        35
scan cmp.i  <     loop, <      loop
     mov.i  *   loop+1, >      loop
loop jmp.x  $     scan, {       -12

	end boot
