;redcode
;name Der Zweite Blitzkrieg 2021
;author Mike Nonemacher
;strategy quick-scan -> stone-spiral -> 2-pass coreclear -> gate
;assert CORESIZE==8000

; The stone/imp is identical to Mike's original
; I've replaced the old qscan with a modern qscan

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

warr equ ok

BOOT    EQU     3405                    ;Just picked this one at random
C       EQU     328                     ;bombing increment - small, mod-8
GVAL    EQU     -19                     ;decrement for gate
INCR    EQU     20                      ;offset of inc from stone
PTR     EQU     -11                     ;offset of ptr from stone+4
I       EQU     1232                    ;offset of start of spiral from imp
D       EQU     1143                    ;7-point spiral
CMP1    EQU     (start-2)*SC/2+CMPST    ;EQUs for quick-scan
CMP2    EQU     CMP1+4000
MOV1    EQU     (start-1)*SC/2+CMPST-BPTR+67
BPTR    EQU     bptr1                   ;point 67 past what we found
SC      EQU     112                     ;only 34 scans would fit
CMPST   EQU     start+33                ;make sure stone doesn't kill spl/jmps

ok      spl     isp                     ;launch spiral
        mov     gate,   top+BOOT-1+PTR+GVAL ;set up 2-pass clear
        mov     split,  top+BOOT-4-19
        mov     #-PTR-1,top+BOOT-1+PTR
        spl     1
        mov     -1,     0
        spl     1                       ;6 processes for bootstrap
        mov     <src,   <top
top     jmp     @0,     #BOOT+1
imp     mov     0,      D
split   spl     0,      <GVAL
stone   sub     stone+INCR, 1
        mov     <-19,   1
        jmp     -2,     <split+GVAL
        mov     @PTR,   <stone+INCR
jump    jmp     -1,     <GVAL-2
gate    dat     <GVAL-1,#0
isp     mov     imp,    imp+I
        mov     inc,    top+BOOT-4+INCR
        spl     1
        spl     1
        spl     1
        mov     -1,     0               ;generate 15 consecutive processes
src     spl     2,      #jump+1
        jmp     @0,     imp+I
        add     #D,     -1
inc     dat     #C,     #-C
END     qscan

