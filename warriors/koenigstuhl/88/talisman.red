;redcode
;name Talisman
;author John Metcalf
;strategy qscan -> stone/imp
;assert CORESIZE==8000

; qscan - 36 scans in 48 instructions

        qfirst equ (qp2+2*qstep)
        qdist  equ qfirst+qeee
        qstep  equ (qeee*2)
        qeee   equ 130

        qi     equ 7
        qr     equ 7

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

        sdist equ (warr+4716)
        ldist equ (sdist-309)
        idist equ 959
        bdist equ 16

warr    mov imp,           ldist+idist+2
        mov imp,           <warr
        mov imp,           <warr
        mov sbomb,         sdist+bdist
sboot   spl 2,             sdist+5
        spl 2,             <300
        spl 1,             <400
        mov <launch,       <lboot
        mov <stone-1,      <sboot
        djn @sboot,        #5
lboot   jmp @0,            ldist+5

        step equ 2211
        time equ 1819
        hop  equ 20

        spl 0,             0+5
stone   mov stone+bdist-1, <hit+time*step
hit     mov stone+bdist-1, @stone
        sub #step,         @hit
        djn stone,         <2438

sbomb   dat <1-hop,        <1-hop

        istep equ 2667

imp     mov 0,             istep

launch  spl 0,             0+5
        add #istep+1,      iptr
iptr    jmp @0,            launch+idist-istep-1

        end qscan

