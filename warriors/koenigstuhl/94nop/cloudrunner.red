;redcode-94
;name Cloudrunner
;author Simon Wainwright
;strategy stone & imps
;assert CORESIZE==8000

        org    qscan

        qfac   equ 3651 ; 7491 ; 2187 ; 7051
        qdec   equ 7852 ; 5612 ; 1124 ; 4452 ; qdec = (1+qfac^-1) mod 8000

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

        for           50
        dat            0,              0
        rof

        papboot      equ            4195
        stnboot      equ            6547
        squboot      equ  stnboot+2-step

warr    mov       squash,        squboot
        spl            2,           <250
        spl            1,           <350
        spl            1,           <450
        mov       <paper,        {papjmp
        mov       <stone,        {stnjmp
stnjmp  spl      stnboot,           <550
papjmp  djn.f    papboot,           <650

        papstep      equ            4360
        impstep      equ            2667

paper   spl      papstep,              6
        mov       >paper,         }paper
ipaper  spl    impstep+1,              0
        mov      >ipaper,        }ipaper
        spl    impstep*2,           <345
imp     mov.i         #1,        impstep
 
squash  dat          >-1,             >1
 
        step         equ              68
 
stone   spl           #0,              6
        spl           #0,              0
loop    mov        -step,         1+step
        sub.ab        {0,             }0
        djn.f       loop,          <1455

        end

