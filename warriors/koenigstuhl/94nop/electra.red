;redcode-94nop
;name Electra
;author S.Fernandes
;strategy paper/imp
;assert CORESIZE == 8000

      org     qscan

idist   equ     2667
sdista  equ     563
sdistb  equ     2930
sdistc  equ     idist+1

warr    spl     1           ,    {5555
        spl     1           ,    {4444
        spl     1           ,    {3333
        mov     <papera     ,    {boot
boot    spl     silka+2008  ,    {2222
        mov     {silka      ,    {bootb
bootb   djn.f   silka+6968  ,    {1111

silka   spl     @0+8        ,    }sdista
        mov     }silka      ,    >silka
silkb   spl     @0          ,    }sdistb
        mov     }silkb      ,    >silkb
silkc   spl     @0          ,    }sdistc
        mov     }silkc      ,    >silkc
        mov.i   #sdista+sdistb,  }-sdistb
imp     mov.i   #1          ,    idist

stepa   equ     3630
stepb   equ     2920
stepc   equ     2030

papera  spl     stepa       ,    8
        mov     >papera     ,    }papera
paperb  spl     @0          ,    >stepb
        mov     }paperb     ,    >paperb
        mov     bomb        ,    <5274
        mov     {paperb     ,    <paperc
paperc  djn.f   @0          ,    }stepc
bomb    dat     <5334       ,    <2667

        for     47
        dat     0           ,    0
        rof

        qfac   equ 1861
        qdec   equ 1742

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
        jmp    *-6,          {q1
        sne    qptr+qdec*qd, qptr+qdec*qd+qd
        seq    <qtab1,       qptr+qdec*(qd-1)+qd-1
        jmp    qdecode,      qa
qtab0   jmp    warr,         qb
qtab2   dat    qgap,         qf
        end

