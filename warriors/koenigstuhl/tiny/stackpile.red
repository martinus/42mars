;redcode-tiny
;author inversed
;name Stackpile
;strategy Quickscan -> paper. End silk decrement causes 
;strategy multiple copies to stack on top of each other.
;assert CORESIZE == 800

stepX   equ     98
stepY   equ     66
djs     equ     714

qx      equ     48
qy      equ     651
qa1     equ     150 ;((qx - 1) * (qy - 1) % 800)
qb1     equ     250 ;(qa1 * (qa1 + 1) % 800)
qa2     equ     350 ;(qb1 * (qb1 + 1) % 800)
qb2     equ     450 ;(qa2 * (qa2 + 1) % 800)
qa3     equ     197 ;((qx - 1) * qy % 800)
qb3     equ     606 ;(qa3 * (qa3 + 1) % 800)
qb4     equ     752 ;(qx * qy + 1) * (qx * qy % 800)
qa5     equ     699 ;((qx + 1) * qy % 800)
qb5     equ     500 ;(qa5 * (qa5 + 1) % 800)

org     qscan

qscan   sne       qf + qa1  ,     qf + qb1
        seq       qf + qa2  ,     qf + qb2
        djn.f   @ qlo + 1   ,   @ qlo + 1

        sne       qf + qa3  ,     qf + qb3
        seq     } qf        ,     qf + qb4
        jmp     @ qlo + 1   ,   { qf
        
        sne       qf + qa5  ,     qf + qb5
        jmz.f     start     ,   < qf

qf      mul.x   # qx        ,   # qy
        jmz.f   @ qlo + 1   ,   > qf

qlo     mov     }-djs       ,   > qf
        mov     } qlo       ,   { qf
        seq     { qf        ,   > qf
        djn.f     qlo       ,   > qf

start   spl       1         ,   { djs
        spl       1         ,   { djs
        
silkX   spl     @ 0         ,   < stepX
        mov     } silkX     ,   > silkX
        mov     { silkX     ,   < silkY
silkY   djn.f   @ 0         ,   < stepY + 1

