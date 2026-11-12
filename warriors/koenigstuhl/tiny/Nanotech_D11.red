;redcode-tiny
;author inversed
;name Nanotech D11
;strategy 5 line clear, 10 process jmp/add imp spiral
;assert CORESIZE == 800

;     - [ Component Positions ] -
x0      equ     (-CURLINE)
bdi     equ     266
bdc     equ     466
bdl     equ     323
cl      equ     5
xc      equ     x0 + bdc
xl      equ     x0 + bdl

;     - [ Imp Launcher ] -
istep   equ     267
i0      equ     3   ; 3 for 10 process imp, 2 for 20

;     - [ Quickbombing ] -
qa      equ     676
qb      equ     19
qc      equ     58
qd      equ     25
qa0     equ     x0 + qa + 0 * qb
qb0     equ     x0 + qc + 0 * qd
qa1     equ     x0 + qa + 1 * qb
qb1     equ     x0 + qc + 1 * qd
qa2     equ     x0 + qa + 2 * qb
qb2     equ     x0 + qc + 2 * qd
qa3     equ     x0 + qa + 3 * qb
qb3     equ     x0 + qc + 3 * qd
qb4     equ     x0 + qa + 4 * qb
qb5     equ     x0 + qa + 5 * qb
qb6     equ     x0 + qa + 6 * qb

;     - [ Code ] -
org     start

imp     mov.i   # s2 - i0   ,     istep
start   mov     { qa0       ,     qb0
        mov     { qa1       ,     qb1
        mov     { qa2       ,     qb2
        mov       imp       ,     x0 + bdi
        mov     } qa3       ,   { qb3

        ; Reversed imp launcher
        add.f   # istep     ,    -1
        djn       bdi - bdl ,   # 1
s2      spl       2         ,   { qb4
        spl       1         ,   { qb5
        mov.i   { 0         ,   # 0

        mov     } imp       ,   { goi
        mov     < goi       ,   { goc
goc     spl     } xc + cl   ,   { qb6
goi     jmp       xl + i0   ,     s0 + cl

s0      spl     # 0         ,   > 433
        spl     # 171       ,   } 0
        mov     < 163       ,   }-1
        mov     {-1         ,   { 769
        djn.f    -2         ,   < 586

