;redcode-94nop
;name Kaitain
;author Stefan Kammann & Forge-AI
;strategy oneshot with lattice quickscanner: lattice q^i (own decode line,
;strategy see Arvon) -> oneshot scan -> spl/dat clear with imp failsafe
;strategy oneshot/clear/boot based on King Cobra by inversed,
;strategy q-decode structure after Azathoth by John Metcalf
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

; body (King Cobra patterns)
step    equ     19
hop     equ     10
zofs    equ     2372
dsafe   equ     9
ssafe   equ     shift+1060
shift   equ     (step-2)
djs     equ     124
bdist   equ     6055
x0      equ     (-CURLINE)

; lattice quickscanner (Arvon line): qdec = 1 + qfac^-1 mod CORESIZE
qfac    equ     1533
qdec    equ     2198
qgap    equ     -67
qstep   equ     9
qtime   equ     15

qa      equ     (qfac*(qtab0-1-qptr)+1)
qb      equ     (qfac*(qtab0-qptr)+1)
qc      equ     (qfac*(qtab1-1-qptr)+1)
qd      equ     (qfac*(qtab1-qptr)+1)
qe      equ     (qfac*(qtab1+1-qptr)+1)
qf      equ     (qfac*(qtab2-qptr)+1)

org     qscan

        ; clear
cptr    dat       zofs+hop+1,     zofs
bptr    dat       1         ,     dsafe
cs0     spl     # djs       ,     ssafe
clear   mov     * bptr      ,   > cptr
        mov     * bptr      ,   > cptr
        djn.f     clear     ,   } cs0

        ; lattice decode + bomber
qdecode mul.b   * q1        ,   qptr
q0      sne     < qtab0     , @ qptr
q1      add.b     qtab1     ,   qptr
q2      mov       qtab2     , @ qptr
qptr    mov       qtab2     , * qdec
        add     # qstep     ,   qptr
        djn       q2        , # qtime
        djn.f     boot      , < qc
qtab1   dat       4000      ,   qd
        dat       4000      ,   qe

qscan   sne     qptr+qdec*qe, qptr+qdec*qe+qe
        seq     < qtab1+1   , qptr+qdec*(qe-1)+qe-1
        jmp       qdecode   , } q1
        sne     qptr+qdec*qb, qptr+qdec*qb+qd
        seq     < qtab0     , qptr+qdec*(qb-1)+qd
        jmp       qdecode   , { qdecode
        sne     qptr+qdec*qa, qptr+qdec*qa+qd
        seq     < qtab0-1   , qptr+qdec*(qa-1)+qd
        djn.a     qdecode   , { qdecode
        sne     qptr+qdec*qf, qptr+qdec*qf+qd
        seq     < qtab2     , qptr+qdec*(qf-1)+qd
        jmp       qdecode   , } qdecode
        sne     qptr+qdec*qc, qptr+qdec*qc+qc
        seq     < qtab1-1   , qptr+qdec*(qc-1)+qc-1
        jmp       qdecode   , { q1
        sne     qptr+qdec*qd, qptr+qdec*qd+qd
        seq     < qtab1     , qptr+qdec*(qd-1)+qd-1
        djn.f     qdecode   , < qa
qtab0   djn.f     boot      , < qb
qtab2   dat       qgap      ,   qf

    for 21
        dat       0         ,   0
    rof

        ; oneshot scan
loop    sub       inc           , @ 3
        seq     { loop-shift    , < loop-shift
        sne     { loop-shift    , < loop-shift
        djn.f     loop          , < loop-shift
inc     spl     * loop-shift+1  , < loop-shift
        mov.i   # 4000          ,   1

        ; boot
boot    mov     { from          ,   { btptr
        mov     < from          ,   < btptr
        djn       boot          ,   # 6
btptr   spl       x0+bdist+6    ,     x0+bdist-shift+6
        mov.f   # 0             ,   { 0
from    dat       loop+6        ,     cptr+6

    for 31
        dat       0         ,     0
    rof

end
