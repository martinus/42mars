;redcode-94nop
;name Rogue
;author John Metcalf
;strategy qscan -> binary paper/imp
;assert CORESIZE==8000

        org    qscan

warr    spl    2,          >qc
qtab1   spl    1,          >qd
        spl    1,          >qe
        spl    boot,       <4000

;       version    2026    2015

        pstepa equ 4435  ; 2970
        pstepb equ 365   ; 1155
        bpos   equ 12    ; 2466
        istep  equ 2667

        mov    <ptr1,      {ptr1
ptr1    jmp    papera-istep+6, papera+6

boot    mov    <ptr2,      {ptr2
ptr2    spl    papera+istep+6, papera+6

papera  spl    @0,         >pstepa
        mov    }papera,    >papera
paperb  spl    @0,         >pstepb
        mov    }paperb,    >paperb
        mov.i  #1,         {1
        mov.i  #bpos,      2667

        for    58
        dat    0,0
        rof

;       version    2026    2015

        qfac   equ 2431  ; 941
        qdec   equ 1472  ; 2662
        qtime  equ 24    ; 18
        qstep  equ -8    ; -7
        qgap   equ 93    ; 87

        qa     equ ((qfac*(qtab0-1-qptr)+1)%8000)
        qb     equ ((qfac*(qtab0-qptr)+1)%8000)
        qc     equ ((qfac*(qtab1-1-qptr)+1)%8000)
        qd     equ ((qfac*(qtab1-qptr)+1)%8000)
        qe     equ ((qfac*(qtab1+1-qptr)+1)%8000)
        qf     equ ((qfac*(qtab2-qptr)+1)%8000)

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
qtab0   jmp    warr,         <qb

qdecode mul.b  *q1,          qptr
q0      sne    <qtab0,       @qptr
q1      add.b  qtab1,        qptr
q2      mov    qtab2,        @qptr
qptr    mov    qtab2,        *qdec
        add    #qstep,       qptr
        djn    q2,           #qtime
        jmp    warr,         <4000

qtab2   dat    qgap,         qf

