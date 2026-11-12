;redcode-88
;name Imperfect
;author LAchi
;assert 1

; suicidal .5c bomber

start mov  bomb  , @dest
dest  mov  bomb  , @ 3364-1
      add #3364*2,  dest
      jmp  start
bomb  dat #     0, # 3364

; launch the bomber
; launch 2 sequential imps

boot  spl  start
      spl @     0,   4000
      mov  imp   , @   -1
imp   mov       0,      1

      end boot
