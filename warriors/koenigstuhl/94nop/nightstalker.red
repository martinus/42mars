;redcode-94nop
;name Nightstalker
;author John Metcalf
;strategy stone/imp
;assert CORESIZE==8000

        org    qscan

        sdist  equ 1000
        ldist  equ 1588 ; 2089
        idist  equ 140  ; 2024
        bdist  equ 22   ; 23

warr    mov    imp,          warr+ldist+idist
        mov    sbomb,        warr+sdist+bdist
        spl    1,            {200
        mov    <stone-2,     {sboot
        spl    1,            {300
        mov    <launch,      {lboot
        mov    <stone-2,     {sboot
lboot   spl    warr+ldist+4, {400
sboot   djn.f  warr+sdist+6, {500

        step   equ 6141 ; 4873
        hop    equ 13   ; 6
        time   equ 1531 ; 1621

        spl    #0,           0+6
        spl    #0,           0
stone   mov    stone+bdist-2,>hit+time*step-hop
hit     mov    stone+bdist-2,@stone
        sub    #step,        @hit
        djn.f  stone,        <3793 ; -1488

sbomb   dat    >1,           >hop

        istep  equ 2667

imp     mov.i  #3,           istep

launch  spl    #0,           0+4
        sub.f  #-istep,      iptr
iptr    djn.f  launch+idist-istep*4, <4265 ; 2896

        for    50
        dat    0,0
        rof

        qfac   equ 3067 ; 1533 ; 1949 ; 5733
        qdec   equ 4404 ; 2198 ; 2550 ; 4398

        qa     equ (qfac*(qtab0-1-qptr)+1)
        qb     equ (qfac*(qtab0-qptr)+1)
        qc     equ (qfac*(qtab1-1-qptr)+1)
        qd     equ (qfac*(qtab1-qptr)+1)
        qe     equ (qfac*(qtab1+1-qptr)+1)
        qf     equ (qfac*(qtab2-qptr)+1)

        qtime  equ 21  ; 18
        qstep  equ 7   ; -7
        qgap   equ -80 ; 87

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

