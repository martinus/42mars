;redcode-nano
;assert 1
;author hwm
;name flight by day & night
;strategy paper
dist equ 35
x1 equ 0
x2 equ 18
boot spl.a  #     x1, <    -dist
     mov.i  }     boot, >     boot
     mov.i  {     dist-1, <     x2+2
     mov.i  >     23, {     -7
     djn.f  $     41, <   -x2
end
