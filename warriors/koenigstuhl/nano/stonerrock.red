;redcode-nano
;assert CORESIZE==80
;author hwm
;name stoner rock
;strategy stone

org bt

x1 equ 5
x2 equ 23
bt spl.f  #      -15, <    -x1
  mov.i  *    x1-bt, <    -x1+bt
  mov.i  >     x2+1, $    -x2
  add.f  $     bt+1, $     bt+2
  djn.i  $     bt+1, @     bt+1
end

