;redcode-94x
;name D-clear X 32
;author Steve Gunnell
;strategy d-clear.
;assert 1

GAP1    equ     31
GAP2    equ     27
REPEAT  equ     0
HOP     equ     (clrbomb-ptr+3)
SAFETY  equ     2
IMPNUM  equ		4

ptr     dat     500,    18062
        for GAP1
        dat.f  $0,     $0
        rof
clear   spl     #0,     >ptr
loop    mov     clrbomb,>ptr
        for REPEAT
        mov     clrbomb,>ptr
        rof
tail    djn.f   loop,   >ptr

        for GAP2
        dat.f  $0,     $0
        rof
        for SAFETY
        dat <IMPNUM+IMPNUM+1, HOP
        rof
clrbomb dat <IMPNUM+IMPNUM+1, HOP


        end     clear

