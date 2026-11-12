;redcode-tiny
;author inversed
;name Desync
;strategy Proof of concept silk replicator with desynchronized execution
;date 2022.04.12
;assert CORESIZE == 800

step    equ     296
qdec    equ     599
bdec    equ     217
atkB    equ     771
bdist   equ     377
bofs    equ     silk+bdist

qx      equ     100
qy      equ     65
qa1     equ     ((qx - 1) * qy + 1) * (((qx - 1) * qy) % 800)
qb1     equ      (qx - 1) * qy
qa2     equ     ( qx      * qy + 1) * (( qx      * qy) % 800)
qa3     equ     ((qx + 1) * qy + 1) * (((qx + 1) * qy) % 800)
qb3     equ      (qx + 1) * qy

org     qscan

qscan   sne.f     qf+qa1,     qf+qb1
        seq.f     qf+qa2,   } qf
        jmp     @ qlo+1 ,   { qf
        sne.f     qf+qa3,     qf+qb3
        jmz.f     start ,   < qf

qf      mul.x   # qx    ,   # qy
        jmz.f   @ qlo+1 ,   > qf

qlo     mov     } qdec  ,   > qf
        mov     } qlo   ,   { qf
        seq     { qf    ,   > qf
        djn.f     qlo   ,   > qf

start   spl       0     ,   } 0         ; Create 6 processes:
        spl       1     ,   {-qdec      ; 2 in front, 4 delayed.
        mov     } silk  ,   } inc
        djn.f     bofs  ,   < bdec

silk    spl     @ 0     ,   } step      ; Becomes spl @2 after the
        mov     } silk  ,   > silk      ; front processes execute.
inc     spl     # bofs  ,     silk+step ; B-field necessary for replication.
        mov.i   # 1     ,   < 1
        djn      -1     ,   # atkB

