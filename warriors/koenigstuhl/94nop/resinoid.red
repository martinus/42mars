;redcode-94nop
;name Resinoid
;author John Metcalf
;strategy dual resin with silk-launched imps
;assert CORESIZE==8000

        org    qscan

        bpos   equ resin+1300

warr    spl    2,        <729
        spl    1,        <1192
        spl    1,        >2419

        mov    {resin,   {cboot1
        mov    {resin+6, {cboot2
        mov    {papera,  {pboot

cboot1  spl    bpos+4000,}3386
cboot2  spl    bpos,     {4399
pboot   djn.f  bpos-3800,<5249

; silk-launched imps

        pstep  equ 1064
        istep  equ 2667

papera  spl    @0+6,     pstep
        mov    }papera,  >papera
paperb  spl    istep+1,  0
        mov    >paperb,  }paperb
        spl    >0,       {istep*2
imp     mov.i  #1,       istep

; clear inspired by GT

resin   spl    #0+6,     <resin-100
        spl    #2000,    <resin-100
clear   mov    1,        <1
        mov    <0,       <3321
        djn.f  clear,    <resin-100

        for    50
        dat    0,        0
        rof

        qfac   equ 3067
        qdec   equ -3596

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
        jmp    warr,         qc
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

        end

