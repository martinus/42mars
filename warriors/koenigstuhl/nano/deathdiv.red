;redcode-nano
;name Death by Division
;author inversed
;strategy mov/spl/mov/mov/div
;assert CORESIZE==80

fwd     equ     8
bck     equ     s0-6
aval    equ     44
bval    equ     31
qa      equ     41
qb      equ     57

    mov     > qa    ,     qb
s0  spl     # fwd   ,   } s0
    mov     { bck   ,   } s0
    mov     < aval  ,   { bck
    div.x   > 0     ,     bval

