;redcode-94x
;name Immortal
;author John Metcalf
;strategy qscan -> paper/imp
;assert CORESIZE==55440

        org qscan

        step1    equ 39710
        step2    equ 43810
        istep    equ 29179        ; istep = (19^-1) mod 55440

warr    spl    2                  ; 10 parallel processes
        spl    2
        spl    1
        spl    1

        mov    <boot,    {boot
boot    spl    30000,    papera+10

papera  spl    @0,       {step1
        mov    }papera,  >papera
paperb  spl    @0,       {step2
        mov    }paperb,  >paperb
        spl    1,        <13860

inc     spl    #istep,   -3       ; vortex launcher
        add    inc,      launch
launch  djn.f  imp-istep*20,<27720

        dat    0,0

imp     mov.i  #istep,   *0

        for    154
        dat    0,0
        rof

        qfac   equ 1597  ; 1229  ; 1937
        qdec   equ 24614 ; 11910 ; 18834 ; qdec = (1+qfac^-1) mod 55440

        qa     equ ((qfac*(qtab0-1-qptr)+1)%CORESIZE)
        qb     equ ((qfac*(qtab0-qptr)+1)%CORESIZE)
        qc     equ ((qfac*(qtab1-1-qptr)+1)%CORESIZE)
        qd     equ ((qfac*(qtab1-qptr)+1)%CORESIZE)
        qe     equ ((qfac*(qtab1+1-qptr)+1)%CORESIZE)
        qf     equ ((qfac*(qtab2-qptr)+1)%CORESIZE)

        qtime  equ 24
        qstep  equ -7
        qgap   equ 94

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
        jmp    qdecode,      <qa
qtab0   jmp    warr,         <qb
qtab2   dat    qgap,         qf

