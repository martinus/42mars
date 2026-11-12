;redcode
;name Return to the Citadel
;author Simon Wainwright
;strategy round 3: qscan -> paper/imp
;strategy unlikely? should squish all
;strategy those stones everyone enters
;assert 1

        qf equ (qgo+1*qs)
        qd equ 100
        qs equ (2*qd)
        qi equ 7
        qr equ 7
qbomb   dat <qi/2-qi*qr,<qi*qr-qi/2
        dat #12*qs      ;a
qp1     dat #5*qs       ;b
qp2     dat #2*qs       ;c
qp3  ;  dat #1*qs       ;d
qgo     cmp qd+qf,      qf ;d
        jmp qskip,      <qf+4
        cmp qd+qf+qs*5, qf+qs*5
        jmp qfast,      <qf+qs*5+4
        cmp qd+qf+qs*12,qf+qs*12
q1      djn qfast,      #qp1
        cmp qd+qf+qs*7, qf+qs*7
        jmp qslow,      <qf+qs*7+4
        cmp qd+qf+qs*14,qf+qs*14
        jmp qslow,      <q1
        cmp qd+qf+qs*10,qf+qs*10
q2      djn qslow,      #qp2
        cmp qd+qf+qs*2, qf+qs*2
        jmp qslow,      <qfast
        cmp qd+qf+qs*8, qf+qs*8
        jmp qslower,    <qf+qs*8+4
        cmp qd+qf+qs*15,qf+qs*15
        jmp qslower,    <q1
        cmp qd+qf+qs*11,qf+qs*11
        jmp qslower,    <q2
        cmp qd+qf+qs*9, qf+qs*9
q3      djn qslower,    #qp3
        cmp qd+qf+qs*3, qf+qs*3
        jmp <qfast,     <qf+qs*3+4
        cmp qd+qf+qs*6, qf+qs*6
        jmp <qfast,     <q2
        cmp qd+qf+qs*4, qf+qs*4
        jmp <qfast,     <q3
        cmp qd+qf+qs*16,qf+qs*16
        slt <q3,        <q1
        jmz pgo,        qd+qf+qs*8+10
qslower add @q3,        @q2
qslow   add @q2,        qkil
qfast   add @q1,        @qslow
qskip   jmn qloop,      @qkil
        add #qd,        qkil
qloop   mov qbomb,      @qkil
qkil    mov qbomb,      <qf
        sub #qi,        @qloop
        djn qloop,      #qr+2

pgo     spl     1,  <1000
        spl     1,  <2000
        spl     1,  <3000
        mov  <src,   <des
        jmp  @des,  <4000
src     mov    #8,     @8
        mov  <src,   <des
des     spl    @0,   2376
        mov  4000,   <des
        spl   src,   <des
        spl  2668,   <des
        mov    -1,   2667
        mov     0,   2667
        end   qgo

