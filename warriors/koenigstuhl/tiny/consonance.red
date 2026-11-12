;redcode-tiny
;author inversed
;name Consonance
;strategy Quickscan -> resonant coreclear-type paper
;assert CORESIZE == 800

; 3 * X + Y = 1
stepX   equ     0 + (1 * time)
stepY   equ     1 - (3 * time)
time    equ     106
ma      equ     523
djs     equ     403

qx      equ     150
qy      equ     577
qa1     equ     ((qx - 1) * qy + 1) * (((qx - 1) * qy) % 800)
qb1     equ     (qx - 1) * qy
qa2     equ     (qx * qy + 1) * ((qx * qy) % 800)
qa3     equ     ((qx + 1) * qy + 1) * (((qx + 1) * qy) % 800)
qb3     equ     (qx + 1) * qy

org     qscan

qscan   sne.f     qf + qa1  ,     qf + qb1
        seq.f     qf + qa2  ,   } qf
        jmp     @ qlo + 1   ,   { qf
        sne.f     qf + qa3  ,     qf + qb3
        jmz.f     start     ,   < qf

qf      mul.x   # qx        ,   # qy
        jmz.f   @ qlo + 1   ,   > qf

qlo     mov     } djs       ,   > qf
        mov     } qlo       ,   { qf
        seq     { qf        ,   > qf
        djn.f     qlo       ,   > qf

start   spl       2         ,   {-djs
        spl       1         ,   {-djs - 2
        spl       1         ,   {-djs - 4

silkY   spl     @ 0         ,   > stepY
        mov     } silkY     ,   > silkY
silkX   spl     @ 0         ,   > stepX
        mov     } silkX     ,   > silkX
        mov     > ma        ,   { 0
        djn.f    -2         ,   < djs

