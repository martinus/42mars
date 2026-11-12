;redcode-94nop
;name Arvon
;author Stefan Kammann & Forge-AI
;strategy paper/stone: lattice quickscanner (decode structure after Azathoth
;strategy by John Metcalf, lattice re-parameterized via a data-driven
;strategy coverage model) -> self-metering parallel boot -> silk paper + stone
;strategy body evolved from my pst_v3/v4 line (Azathoth patterns, own constants)
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

org     qscan

;---------------<< lattice quickscanner: qdec = 1 + qfac^-1 mod 8000 >>--------;

qfac    equ     163
qdec    equ     1228
qgap    equ     -67
qstep   equ     9
qtime   equ     15

qa      equ     (qfac*(qtab0-1-qptr)+1)
qb      equ     (qfac*(qtab0-qptr)+1)
qc      equ     (qfac*(qtab1-1-qptr)+1)
qd      equ     (qfac*(qtab1-qptr)+1)
qe      equ     (qfac*(qtab1+1-qptr)+1)
qf      equ     (qfac*(qtab2-qptr)+1)

qdecode mul.b   * q1        ,   qptr
q0      sne     < qtab0     , @ qptr
q1      add.b     qtab1     ,   qptr
q2      mov       qtab2     , @ qptr
qptr    mov       qtab2     , * qdec
        add     # qstep     ,   qptr
        djn       q2        , # qtime
        djn.f     warr      , < qc
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
qtab0   djn.f     warr      , < qb
qtab2   dat       qgap      ,   qf

        for       31
        dat       0         ,   0
        rof

;---------------<< launcher: self-metering 6-process parallel boot >>----------;

pbo2    equ     843
sbo     equ     3200
pboot   equ     warr + pbo2
sboot   equ     warr + sbo
d1      equ     3828
d2      equ     2602
d3      equ     1351
d4      equ     3493
d5      equ     1406
d6      equ     3947

warr    spl     2           , < -d1
        spl     1           , { -d2
        spl     1           , } -d3
        mov     < p         , { p
        mov     < sgo       , { s
s       spl     sboot       , < d4
        spl     * s         , { d5
        spl     * s         , { d6
p       djn.f   pboot       , } silk1 + 6

;---------------<< stone: bidirectional (runs at sboot-6..sboot-1) >>----------;

sstep   equ     2431
stime   equ     1470
sback   equ    -2122
sfirst  equ     (shit + sptr + sstep * stime)

sgo     spl     # 0         ,   6
sloop   mov       sbomb     , @ sptr
shit    sub.x   # sstep*2   , @ sloop
sptr    mov     { sback     , } sfirst
sdjn    djn.f   @ shit      , } sptr
sbomb   dat     } sstep     , > 1

;---------------<< paper: 3 silk streams (runs at pboot-6..pboot-1) >>---------;

pstep   equ     1365

silk1   spl     pstep       , { px
        mov     } px        , } silk1
        mov     } px + 3    , } silk1
px      mov     { px + 3    , } silk1
        jmz.f   @ px - 1    , * px

;------------------------------------------------------------------------------;

        end

