;redcode-94nop
;name Killer Frogs 94
;author John Metcalf
;strategy stone -> paper/imp
;assert CORESIZE==8000

        qfac   equ 3449
        power  equ 3199

        for 20+!(r=1)*(x=qfac)*(n=power)
        for n%2
        for !r=(r*x)%CORESIZE
        rof
        rof
        for !x=(x*x)%CORESIZE+!n=n/2
        rof
        rof

        qdec   equ (r+1)

        qa     equ (qfac*(qtab0-1-qptr)+1)
        qb     equ (qfac*(qtab0-qptr)+1)
        qc     equ (qfac*(qtab1-1-qptr)+1)
        qd     equ (qfac*(qtab1-qptr)+1)
        qe     equ (qfac*(qtab1+1-qptr)+1)
        qf     equ (qfac*(qtab2-qptr)+1)

        qtime  equ 18
        qstep  equ -7
        qgap   equ 87

qdecode mul.b  *q1,          qptr
q0      sne    <qtab0,       @qptr
q1      add.b  qtab1,        qptr
q2      mov    qtab2,        @qptr
qptr    mov    qtab2,        *qdec
        add    #qstep,       qptr
        djn    q2,           #qtime
        jmp    paper,        qc
qtab1   dat    4000,         qd
        dat    4000,         qe

qscan   sne    qptr+qdec*qe, qptr+qdec*qe+qe
        seq    <qtab1+1,     qptr+qdec*(qe-1)+qe-1
        jmp    qdecode,      }q1
        sne    qptr+qdec*qb, qptr+qdec*qb+qd
        seq    <qtab0,       qptr+qdec*(qb-1)+qd
        jmp    qdecode,      {qdecode
        sne    qptr+qdec*qa, qptr+qdec*qa+qd
        seq    <qtab0-1,     qptr+qdec*(qa-1)+qd
        djn.a  qdecode,      {qdecode
        sne    qptr+qdec*qf, qptr+qdec*qf+qd
        seq    <qtab2,       qptr+qdec*(qf-1)+qd
        jmp    qdecode,      }qdecode
        sne    qptr+qdec*qc, qptr+qdec*qc+qc
        seq    <qtab1-1,     qptr+qdec*(qc-1)+qc-1
        jmp    qdecode,      {q1
        sne    qptr+qdec*qd, qptr+qdec*qd+qd
        seq    <qtab1,       qptr+qdec*(qd-1)+qd-1
        jmp    qdecode,      qa
qtab0   jmp    warr,         qb
qtab2   dat    qgap,         qf

        for    52
        dat    0,0
        rof

        warr  equ boot

        sstep equ 7585
        bdist equ (paper+8+sstep)

boot    mov    stone+3,     bdist
        mov    stone+2,     <boot
        mov    stone+1,     <boot
        mov    stone,       <boot
        jmp    @boot

stone   mov    {4000,       sstep-1
        add    inc,         stone
inc     jmz.f  stone,       <sstep
        jmp    paper-bdist

        step1  equ 1480
        istep  equ 1143           ; (CORESIZE+1)/7

paper   spl    1,           <-300       ; 8 parallel processes
        spl    1,           <-400
        spl    1,           <-500

papera  spl    @0,          {step1
        mov    }-1,         >-1
        spl    0                        ; vortex launcher
        add.a  #istep,      launch
launch  djn.f  imp-istep*8, {6*100

imp     mov.i  #1,          istep

        end    qscan

