;redcode-94nop
;name Elixir
;author John Metcalf
;strategy agony-style scanner from scratch
;strategy more tweaks
;assert CORESIZE==8000

        org    qscan

        warr   equ ptr
        step   equ 3121
        first  equ (scan+step)

        count  equ 16
        gap    equ 8
        inc    equ sbmb

scan    add    inc,        ptr
ptr     sne    first-gap,  first
        add    inc,        ptr
        seq    *ptr,       @ptr
        slt.ab #25,        ptr
        djn.f  scan,       <4720

wptr    mov.b  ptr,        #0
cnt     mov.x  #14,        dbmb
wipe    mov    sbmb,       <wptr
        mov    sbmb,       <wptr
        djn.a  wipe,       dbmb

        jmz    scan,       scan-1

sbmb    spl    #step,      step
clear   mov    dbmb,       >wipe-4
        djn.f  clear,      {wipe-4
        dbmb   equ (cnt+count/2)

        for    55
        dat    0,0
        rof

        qfac   equ 1533
        power  equ 3199

; --------------------------------------
; calculate power using the binary method
; --------------------------------------

;       qdec   equ qfac^power

        for 20+!(r=1)*(x=qfac)*(n=power)
        for n%2
        for !r=(r*x)%CORESIZE
        rof
        rof
        for !x=(x*x)%CORESIZE+!n=n/2
        rof
        rof

        qdec   equ (r+1) ; (1+qfac^-1) mod 8000

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


