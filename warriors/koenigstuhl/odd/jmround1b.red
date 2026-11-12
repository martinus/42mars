;redcode-mp
;name Heliotrope
;author John Metcalf
;strategy qscan -> stone/imp
;assert CORESIZE == 8000

        org    qscan

        qfac   equ 2259 ; 3771 ; 1533
        qdec   equ 2140 ; 6132 ; 2198

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

        for    43
        dat    0,0
        rof

        step   equ 4655

inc     spl    #step,        >-step
stone   mov    >step,        1-step
        add    inc,          stone
        djn.f  stone,        <-2496

        istep  equ 2667
        iboot  equ warr+5645
        sboot  equ warr+5345

warr    mov    inc+3,         sboot+3
        mov    inc+2,         <warr
        mov    inc+1,         <warr
        mov    inc,           <warr
        mov    #-9,           sboot+6

start   spl    @warr,         <1450
        mov    imp,           iboot
        spl    8,             <1550
        spl    4,             <1650
        spl    2,             <1750
        jmp    iboot,         <1850
        jmp    iboot+istep,   <1950
        spl    2,             <2050
        jmp    iboot+istep*2, <2150
        jmp    iboot+istep*3, <2250
        spl    4,             <2350
        spl    2,             <2450
        jmp    iboot+istep*4, <2550
        jmp    iboot+istep*5, <2650
        spl    2,             <2750
        jmp    iboot+istep*6, <2850
        jmp    iboot+istep*7, <2950

imp     mov.i  #1,            istep

        end

