;redcode-94nop
;name smart clear
;author Christian Schmidt
;strategy core clear with qscanner
;assert CORESIZE==8000


bptr1   equ     6332
bptr2   equ     (bptr1+39)

warr    mov     g1,          bptr1
        mov     g2,          bptr1
        mov     b,           bptr2
        mov     b1,          bptr2
boot2   mov     {bptr3,      <bptr3
        mov     {bptr3,      <bptr3
        mov     {bptr3,      <bptr3
        mov     {bptr3,      <bptr3
        jmp     @bptr3,      {0

g1      dat     st+17,       500     
g2      dat     -4040,       4045
st      spl     #b-g1+35,    45   
        mov     *g1-17,      >g1-17  
        mov     *b+18,       >g2-17  
cc      djn.f   -1,          {g2-17  
b       dat     #1,          45      
b1      spl     #-40,        45     

bptr3   dat     cc+1,        boot2+bptr1+19

        for    52
        dat    0,0
        rof

        qfac   equ 1533
        qdec   equ 2198 ; qdec = (1+qfac^-1) mod 8000

        qa     equ (qfac*(qtab0-1-qptr)+1)
        qb     equ (qfac*(qtab0-qptr)+1)
        qc     equ (qfac*(qtab1-1-qptr)+1)
        qd     equ (qfac*(qtab1-qptr)+1)
        qe     equ (qfac*(qtab1+1-qptr)+1)
        qf     equ (qfac*(qtab2-qptr)+1)

        qtime  equ 21
        qstep  equ 7
        qgap   equ -80

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
