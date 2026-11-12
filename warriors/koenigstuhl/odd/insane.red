;redcode-94x
;name inSaNe
;author Christian Schmidt
;strategy kind of clear
;assert 1



ptr   dat  40,  -20

for 7
      dat 0, 0
rof
incr  dat  3, -3
start mov.i ptr, <ptr
      mov.i ptr, }ptr
      add.f incr, ptr
      mov.i ptr, }ptr
      mov.i ptr, <ptr
      spl -5,    <(ptr-3)
      mov.i ptr, }ptr
      mov.i ptr, <ptr
      add.f incr, ptr
      mov.i ptr, <ptr
      mov.i ptr, }ptr

end start
