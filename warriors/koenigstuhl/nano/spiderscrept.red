;redcode-nano
;assert 1
;author hwm
;name the spiders crept
;strategy paper/imp
;strategy no. 1 on the hill 06/11/2007
;strategy paper then two imp spirals

step equ 16
boot: spl.a  #    0, <  step+1
     mov.i  } boot, }       1
     spl.ba <   53, >   -step
imp:  mov.i  *   31, < -step/2
     djn.f  $  imp, <      46
end

