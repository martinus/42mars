;redcode-tiny
;author inversed
;name Nanotech A8
;strategy 4 line clear, 20 process jmp/add imp spiral
;assert CORESIZE == 800

;     - [ Component Positions ] -
x0      equ     (-CURLINE)
bdi     equ     266
bdc     equ     521
bdl     equ     350
cl      equ     5
xc      equ     x0 + bdc
xl      equ     x0 + bdl

;     - [ Imp Launcher ] -
istep   equ     267
i0      equ     2   ; 3 for 10 process imp, 2 for 20

;     - [ Quickbombing ] -
qa      equ     625
qb      equ     14
qc      equ     151
qd      equ     780
qa0     equ     x0 + qa + 0 * qb
qb0     equ     x0 + qc + 0 * qd
qa1     equ     x0 + qa + 1 * qb
qb1     equ     x0 + qc + 1 * qd
qa2     equ     x0 + qa + 2 * qb
qb2     equ     x0 + qc + 2 * qd
qa3     equ     x0 + qa + 3 * qb
qb3     equ     x0 + qc + 3 * qd
qa4     equ     x0 + qa + 4 * qb
qb4     equ     x0 + qc + 4 * qd
qb5     equ     x0 + qa + 5 * qb
qb6     equ     x0 + qa + 6 * qb
qb7     equ     x0 + qa + 7 * qb

;     - [ Code ] -
org     start

imp     mov.i   # s2 - i0   ,     istep
start   mov     { qa0       ,     qb0
        mov     { qa1       ,     qb1
        mov     { qa2       ,     qb2
        mov     { qa3       ,     qb3
        mov       imp       ,     x0 + bdi
        mov     } qa4       ,   { qb4

        ; Reversed imp launcher
        add.f   # istep     ,    -1
ja      djn       bdi - bdl ,   # 1
s2      spl       2         ,   { qb5
s1      spl       1         ,   { qb6
        mov.i   { 0         ,   # 0
        
        mov     } imp       ,   { gol
        mov     < gol       ,   { goc
goc     spl       xc + cl   ,   { qb7
gol     jmp       xl + i0   ,     s0 + cl

s0      spl     # 247       ,   > 37      
        mov     } 0         ,   > 36      
        mov     > 466       ,   { 776     
        djn.f    -2         ,   }-3  

