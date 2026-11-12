;redcode-nano
;name Urusai
;author inversed
;strategy Oneshot/Imp
;assert CORESIZE==80

step    equ     -5
zofs    equ     -9
aval    equ      4

x0      equ     loop
org     loop+1

loop    add     # step  ,     ptr
ptr     jmz.f     loop  ,     x0+zofs

        mov.i   # aval  ,   > ptr
        spl     { 0     ,   } 0
        mov.i   # 1     ,     1

