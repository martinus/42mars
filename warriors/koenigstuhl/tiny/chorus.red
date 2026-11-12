;redcode-tiny
;author inversed
;name Chorus
;strategy Quickbomb -> Timescape-type paper with mirrored resonance
;assert CORESIZE == 800

stepX   equ     67  ; 6 * 67 = 402
stepY   equ     12
m1a     equ     688
m1b     equ     368
m2a     equ     703
m2b     equ     788
djs     equ     45
bdist   equ     400

qa      equ     179
qb      equ     411
qc      equ     764
qd      equ     388

x0      equ     (-CURLINE)
mirror  equ     silkX + bdist + 6
qalpha  equ     x0 + qa + i * qb
qbeta   equ     x0 + qc + i * qd

i for 9
        mov     { qalpha    ,     qbeta
rof

start   spl       2         ,   { x0 + qa + 10 * qb
        spl       1         ,   { x0 + qa + 11 * qb
        spl       1         ,   { x0 + qa + 12 * qb

        mov     { silkX     ,   { bp
bp      spl       mirror    ,   { x0 + qa + 13 * qb

silkX   spl     @ 6         ,   > stepX
        mov     } silkX     ,   > silkX
        mov     > m1a       ,   { m1b
        mov     > m2a       ,   { m2b
        mov     { silkX     ,   { silkY
silkY   djn.f     stepY + 1 ,   < djs

