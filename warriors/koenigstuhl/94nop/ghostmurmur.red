;redcode-94nop
;name Ghost Murmur
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

        org    qscan

        warr   equ ptr

        step   equ 3984 ; 7981 ; 7933 ; 7952 ; 1593 ; 5328 ; 4569 ; 3197
        gap    equ 6    ; 9    ; 5    ; 6    ; 9    ; 6    ; 6    ; 6
        time   equ 492  ; 413  ; 595  ; 497  ; 456  ; 496  ; 467  ; 530
        first  equ (clear+1-step*time)

adj     mov.b  ptr,        #loop
        mov    inc,        >adj
scan    add    inc,        *adj
ptr     seq    >first+gap, first
check   djn.f  @adj+1,     @adj
loop    jmn    scan,       @scan
inc     spl    #step,      <step
clear   mov    dbmb,       >ptr
        djn.f  clear,      >ptr
dbmb    dat    <4001,      10

        for    60
        dat    0,0
        rof

        qfac   equ 4933
        qdec   equ 3598

        qa     equ (qfac*(qtab0-1-qptr)+1)
        qb     equ (qfac*(qtab0-qptr)+1)
        qc     equ (qfac*(qtab1-1-qptr)+1)
        qd     equ (qfac*(qtab1-qptr)+1)
        qe     equ (qfac*(qtab1+1-qptr)+1)
        qf     equ (qfac*(qtab2-qptr)+1)

        qtime  equ 12
        qstep  equ 7
        qgap   equ -80

qdecode mul.b  *q1,          qptr
q0      sne    <qtab0,       @qptr
q1      add.b  qtab1,        qptr
q2      mov    qtab2,        @qptr
qptr    mov    qtab2,        *qdec
        add    #qstep,       qptr
        djn    q2,           #qtime
        jmp    warr,         <qc
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
qtab0   djn.f  warr,         <qb
qtab2   dat    qgap,         qf

        end

