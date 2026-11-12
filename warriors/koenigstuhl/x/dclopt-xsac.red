;redcode-94x
;name D-clear X 47
;author Steve Gunnell
;strategy d-clear.
;assert 1

GAP1    equ     13
GAP2    equ     42
REPEAT  equ     0
HOP     equ     (clrbomb-ptr+4)
SAFETY  equ     3
IMPNUM  equ		40

ptr     dat     500,    11210
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
        dat <IMPNUM, HOP
    rof
clrbomb dat <IMPNUM, HOP


        end     clear

