;redcode-nano
;assert CORESIZE==80
;author hwm
;name breaths of sleeping thoughts v002
;strategy qscan switching to a second pass
;strategy inspired by an old scanner i wrote
;strategy based on unique geometry
x1 equ (CORESIZE/2)
x2 equ 6
x3 equ -27
          seq.i  $   x1-1, $   x1+x2-1
ptr      sub.b  #  x1+x2, >     loop2
loop1 mov.i  }     x3, {     loop2
loop2 mov.i  <     31, }     loop1
           djn.x  $  loop1, >        20
end
