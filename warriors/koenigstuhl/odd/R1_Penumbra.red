;redcode
;name Penumbra
;author inversed
;strategy Hydra + Paper
;strategy Corewar Global Masters 2022 round 1 entry
;assert (CORESIZE==8000)

step    equ     342
cofs    equ     7139
gap     equ     41

org     start

s0      spl     # 0     ,     0
loop    mov.i   # 1     ,   < 1
ptr     spl     @ 0     ,     step
        mov       d     ,   @ ptr
        add     # step+1,     ptr
        jmp       loop  ,     0
d       djn      -1     ,   # cofs

for gap/2
        dat       0     ,     0
rof

start   spl       s0    ,     0
        jmp       ploop

for gap-gap/2
        dat       0     ,     0
rof

len     equ     13
len0    equ     8
pofs    equ     1581
dec     equ     5413

from    mov     # len   ,   # len0
ploop   mov     < from  ,   { to
        jmn       ploop ,     from
        spl       from  ,   { dec
to      jmz       pofs  ,   * 0
