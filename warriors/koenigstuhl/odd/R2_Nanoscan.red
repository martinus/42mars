;redcode
;name Nanoscan Plus
;author inversed
;strategy Corewar Global Masters 2022 round 2 entry
;strategy Basic nano scanner with an extended attack loop
;       (CORESIZE == 160)
;assert 1

org     attack

djs     equ     78
st      equ     83
s0      equ     87

loop    add.ab  # st        ,    # s0
attack  jmz.f     loop      ,    @ loop
        mov.i     bomb      ,    > loop
        mov.i     bomb      ,    > loop
        djn.f     attack    ,    { djs
bomb    mov.i   # 7         ,     -1

