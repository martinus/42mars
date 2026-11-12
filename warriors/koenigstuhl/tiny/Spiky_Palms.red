;redcode-tiny
;author inversed
;name Spiky Palms
;date 2022.05.17
;strategy Silk paper with palm leaves-style bombing
;assert CORESIZE == 800

pstep   equ     119
astep   equ     696
atkB    equ     760
bdist   equ     211
bofs    equ     silk + bdist

qa      equ     739
qb      equ     781
qc      equ     44
qd      equ     64
x0      equ     (-CURLINE)
qalpha  equ     x0 + qa + (i - 1) * qb
qbeta   equ     x0 + qc + (i - 1) * qd

i for 9
        mov     { qalpha,     qbeta
rof

start   spl       2     ,   { x0 + qa +  9 * qb
        spl       1     ,   { x0 + qa + 10 * qb
        spl       1     ,   { x0 + qa + 11 * qb
        mov     < silk  ,   { 1
        spl       bofs  ,   { x0 + qa + 12 * qb

silk    spl       pstep ,     6
        mov     > silk  ,   } silk
        spl     { 0     ,   } 0
        add.x   # astep ,    -2
        mov.i   # 1     ,   < 1
        djn      -2     ,   # atkB

