;redcode-nano
;assert 1
;author hwm
;name wrath of the seas
;strategy double clear

step equ 6
q1 equ -22
q2 equ 38

      spl.f  #  q1-step, >     q2-4
      mov.i  >      -14, {     -q2
clr1 mov.i  }    -step, <     25
clr2 mov.i  }       q1, {     clr1
      mov.i  >   step+4, {     clr2
end 

