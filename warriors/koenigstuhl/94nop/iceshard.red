;redcode-94nop
;name ICE//Shard
;author John Metcalf
;strategy qscan -> hydra/paper/imp
;assert CORESIZE==8000

        org    qscan

        qfac   equ 2259
        qdec   equ 2140 ; qdec = (1+qfac^-1) mod 8000

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
qtab0   jmp    warr,         <qb
qtab2   dat    qgap,         qf

        for    48
        dat    0,0
        rof

        bdist  equ boot1+2000

warr    spl    1,            {5000
        spl    1,            {5100
        spl    1,            {5200
        mov    {papera,      {boot1
        mov    {tspl,        {boot2
boot1   spl    bdist,        {5300
boot2   djn.f  bdist-113,    {5400

        step1  equ 176
        step2  equ 4792
        istep  equ 1143           ; (CORESIZE+1)/7

papera  spl    @8,           }step1
        mov    }papera,      >papera
paperb  spl    @0,           <step2
        mov    }paperb,      >paperb
        spl    0                  ; vortex launcher
        add.x  imp,          launch
launch  djn.f  imp-istep*8,  <-359
imp     mov.i  #3,           istep

        first  equ 500
        step   equ 889

tspl    spl    0+8,          <boot
        mov.i  #1,           <boot
boot    mov    tdjn,         first
        add    #step,        boot
        mov    tspl,         @boot
        djn.f  @boot,        <-100
tdjn    djn    -2,           #3352

        end

