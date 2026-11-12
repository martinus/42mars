;redcode-tiny
;name Desert Rose
;author inversed
;strategy Tiny version of Shrubbery
;date 2022.05.08
;assert CORESIZE == 800

stepX   equ     107
stepY   equ     13
c1      equ     366
c2      equ     37
c3      equ     32
c4      equ     150
bdist   equ     53

qa      equ     788
qb      equ     791
qc      equ     407
qd      equ     27

x0      equ     (-CURLINE)
second  equ     silkX + bdist + 6
qalpha  equ     x0 + qa + i * qb
qbeta   equ     x0 + qc + i * qd

i for 9
        mov     { qalpha    ,     qbeta
rof

start   spl       2         ,   { x0 + qa + 10 * qb
        spl       1         ,   { x0 + qa + 11 * qb
        spl       1         ,   { x0 + qa + 12 * qb
        mov     { silkX     ,   { bp
bp      spl       second    ,   { x0 + qa + 13 * qb

silkX   spl     @ 6         ,   > stepX
        mov     } silkX     ,   > silkX
        add.x   # c1        ,   { c2
        mov     < stepX-1   ,   > c3
        mov     { silkX     ,   { silkY
silkY   djn.f     stepY     ,   < c4

