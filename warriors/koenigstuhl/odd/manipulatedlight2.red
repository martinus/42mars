;redcode-cc
;name Manipulated Light II
;author John Metcalf
;strategy RF16 paper
;strategy 57 characters, approx 126 Wilfiz
;assert 1

s equ spl 1

x s
  s
  s

  for 3
    s -71-395*x
    mov >-1,}-1
  rof

  mov.i #1,<1
  djn -2,#x