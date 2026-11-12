;redcode-94x
;name Simplicity
;author John Metcalf
;strategy qscan -> silk-imps
;assert CORESIZE==55440

        org    qscan

        step1  equ 51696
        step2  equ 35176
        step3  equ 31824

warr    spl    warr2,    <1234
        spl    1,        <2345
        spl    1,        <3456
        spl    1,        <4567

papera  spl    step1
        mov    >papera,  }papera
paperb  spl    step2
        mov    >paperb,  }paperb
paperc  spl    step3
        mov    >paperc,  }paperc
        mov.i  #-step1*2, }step1
        mov.i  #-step2*2, }step2
        mov.i  #-step3*2, }step3

        for    80
        dat    0,0
        rof

        qfac   equ 10207
        qdec   equ 32384

        qa     equ ((qfac*(qtab0-1-qptr)+1)%CORESIZE)
        qb     equ ((qfac*(qtab0-qptr)+1)%CORESIZE)
        qc     equ ((qfac*(qtab1-1-qptr)+1)%CORESIZE)
        qd     equ ((qfac*(qtab1-qptr)+1)%CORESIZE)
        qe     equ ((qfac*(qtab1+1-qptr)+1)%CORESIZE)
        qf     equ ((qfac*(qtab2-qptr)+1)%CORESIZE)

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
        jmp    qdecode,      <qa
qtab0   jmp    warr,         <qb
qtab2   dat    qgap,         qf

        for    65
        dat    0,0
        rof

warr2   spl    1,        <2345
        spl    1,        <3456
        spl    1,        <4567

paperx  spl    step1
        mov    >paperx,  }paperx
papery  spl    step2
        mov    >papery,  }papery
paperz  spl    step3
        mov    >paperz,  }paperz
        mov.i  #-step1*2, }step1
        mov.i  #-step2*2, }step2
        mov.i  #-step3*2, }step3

        end

