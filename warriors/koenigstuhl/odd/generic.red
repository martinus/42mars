;redcode
;assert 1
;author Miz
;name Generic
impsize equ 267
const equ 269
clear spl #-const, #const
      add.f -1, 1
      mov.i  0,0
      jmp -2
for 3
dat 0,0
rof
a spl 1
  spl 1
  spl 2
  jmp @0, imp
  add #impsize, -1
  jmp clear
  imp mov.i #impsize, *0
end a
