;redcode
;name Eye of the Storm
;author John Metcalf
;strategy qscan -> stone/imp
;assert CORESIZE==8000

; qscan - 36 scans in 48 instructions

        qfirst equ (qp2+2*qstep)
        qdist  equ qfirst+qstep*4+126
        qstep  equ 291

        qi  equ 7
        qr  equ 7

qbomb   dat <qi/2-qi*qr,   <qi*qr-qi/2

        qa  equ qstep*16
        qb  equ qstep*5+2
        qc  equ qstep*10
        qd  equ qstep*2
        qe  equ qstep*1

qscan   cmp qdist+qc,      qfirst+qc
        jmp qfast,         <qa
        cmp qdist+qe+qd,   qfirst+qe+qd
qp1     jmp <qfast,        <qc
qp2     cmp qdist,         qfirst
qp3     jmp qskip,         <qe

        cmp qdist+qb,      qfirst+qb
q1      djn qfast,         #qp1

        cmp qdist+qd+qc,   qfirst+qd+qc
        jmp qslow,         <qfirst+qd+qc+4
        cmp qdist+qd+qb,   qfirst+qd+qb
x1      jmp qslow,         <q1
        cmp qdist+qc+qc,   qfirst+qc+qc
q2      djn qslow,         #qp2
        cmp qdist+qd,      qfirst+qd
        jmp qslow,         <qfast
        cmp qdist+qa,      qfirst+qa
        jmp q1,            <q1

        cmp qdist+qa+qd,   qfirst+qa+qd
        jmp x1,            <q1
        cmp qdist+qc+qb,   qfirst+qc+qb
        jmp q2,            <q1
        cmp qdist+qe+qd+qc,qfirst+qe+qd+qc
        jmp qslower,       <qfirst+qe+qd+qc+4
        cmp qdist+qe+qd+qb,qfirst+qe+qd+qb
        jmp qslower,       <q1
        cmp qdist+qe+qc+qc,qfirst+qe+qc+qc
        jmp qslower,       <q2
        cmp qdist+qd+qd+qc,qfirst+qd+qd+qc
q3      djn qslower,       #qp3
        cmp qdist+qe+qc,   qfirst+qe+qc
        jmp <qfast,        <q2
        cmp qdist+qd+qd,   qfirst+qd+qd
        jmp <qfast,        <q3
        cmp qdist+qd+qd+qb,qfirst+qd+qd+qb
        slt <q3,           <q1

        jmz warr,          qdist+qe+qd+qc+10

qslower add @q3,           @qslow
qslow   add @q2,           qkil
qfast   add @q1,           @qslow

qskip   cmp <qdist+qstep+50, @qkil
        jmp qloop,         <1234

        add #qdist-qfirst, qkil
qloop   mov qbomb,         @qkil
qkil    mov <qfirst+qstep+50, <qfirst
        sub #qi,           @qloop
        djn qloop,         #qr+2

        istep  equ 2667           ; (CORESIZE+1)/3
        lpos   equ (qbomb+4300)
        ipos   equ (qbomb+400)
        spos   equ (qbomb+4501)

warr    spl    sboot,        <4100
        spl    iboot,        <4200

        mov     imp,         ipos

        spl    4,            <4300
        spl    2,            <4400
        jmp    ipos+istep*0, <4500
        jmp    ipos+istep*1, <4600
        spl    2,            <4700
        jmp    ipos+istep*2, <4800
        jmp    ipos+istep*3, <4900

iboot   mov    launch,       lpos+2
        mov    launch-1,     <iboot
        mov    launch-2,     <iboot
        jmp    @iboot,       <5000

imp     mov    0,            istep

        spl    0
        add    #istep+1,     launch
launch  djn    @0,           <ipos-lpos+1

sboot   spl    2,            spos+6
        spl    1,            <5100
        spl    1,            <5200
        mov    <sfrom,       <sboot
        jmp    @sboot,       <5300

        gap    equ -12
        sstep  equ 4712

sfrom   spl    0,            stone+5
stone   mov    dbmb,         <hit-sstep
hit     mov    dbmb,         @stone
        sub    #sstep,       @hit
        djn    stone,        <-600
dbmb    dat    <1,           <gap+1+sstep

        end    qscan

