;redcode-nano
;assert CORESIZE==80
;author hwm
;name breaths of sleeping thoughts
; v001
;strategy qscan

x1 equ (CORESIZE/2)
x2 equ 6
x3 equ -27
     seq.i  $       x1, $   x1+x2-1
ptr   mul.ab #  x1+x2+1, >     loop2
loop1 mov.i  }       x3, {     loop2
loop2 mov.i  <       33, }     loop1
     djn.i  $    loop1, >        19
end

