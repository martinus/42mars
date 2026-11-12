;redcode-94nop
;name stoned silk
;author Christian Schmidt
;strategy self-replicating stone with qscanner
;assert CORESIZE==8000

        org    qscan

pStep  equ    558
sStep  equ    2579
pAwa   equ    2563

warr    spl     2,              }6177
        spl     1,              }4696
        spl     1,              }3215
        mov.i   <pBo,           {pBo
pBo     jmp     warr+pAwa,      pEnd+1


        for     6
        dat     0,              0
        rof

        spl     @0,             <pStep
        mov.i   }-1,            >-1
        spl     #sStep,         >-sStep
        mov     {sStep,         {-sStep+1
        add     -2,             -1

pEnd    djn.f   @0,             {-2

        for    53
        dat    0,0
        rof

        qfac   equ 1533
        qdec   equ 2198 ; qdec = (1+qfac^-1) mod 8000

        qa     equ (qfac*(qtab0-1-qptr)+1)
        qb     equ (qfac*(qtab0-qptr)+1)
        qc     equ (qfac*(qtab1-1-qptr)+1)
        qd     equ (qfac*(qtab1-qptr)+1)
        qe     equ (qfac*(qtab1+1-qptr)+1)
        qf     equ (qfac*(qtab2-qptr)+1)

        qtime  equ 21
        qstep  equ 7
        qgap   equ -80

qdecode mul.b  *q1,          qptr
q0      sne    <qtab0,       @qptr
q1      add.b  qtab1,        qptr
q2      mov    qtab2,        @qptr
qptr    mov    qtab2,        *qdec
        add    #qstep,       qptr
        djn    q2,           #qtime
        djn.f  warr,         <qc
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
        djn.f  qdecode,      <qa
qtab0   djn.f  warr,         <qb
qtab2   dat    qgap,         qf

        end
