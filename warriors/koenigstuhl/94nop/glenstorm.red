;redcode-94nop
;name Glenstorm
;author John Metcalf
;strategy stone/paper, paper uses mov.i #1,<1 bombs
;assert CORESIZE==8000

        org  qGo

        sDist  equ pGo+2939

        pStep0 equ 1234
        pStep1 equ 2852
        pStep2 equ 5213
        x      equ 6580
        y      equ 2951

pGo     spl    1
        spl    1
        spl    1

pap0:   spl    @0,             >pStep0
        mov    }pap0,          >pap0
pap1:   spl    pStep1,         0
        mov.i  >pap1,          }pap1
        mov.i  #y,             <1
        mov    -1,             {x
        mov.i  <pap1,          <pap2
pap2:   djn.f  @0,             >pStep2

        for    20
        dat    0,0
        rof

        uStp   equ 703
        uTim   equ 1183

uSpl:   spl    #0,             0
uLp:    mov    uBmb,           @uPtr
uHit:   sub.x  #uStp*2,        @uLp
uPtr:   mov    {4582,          }uHit+2*uStp*uTim
sLoo:   djn.f  @uHit,          }uPtr

        for    5
        dat    0,0
        rof

uBmb:   dat    <uStp,          >1

        dat    0,0

xGo     mov    uSpl,           sDist-6
        mov    uBmb,           sDist+5
        spl    2
        spl    2
sBoot   spl    1,              sDist
        mov    <uSpl+5,        <sBoot
        djn    @xGo,           #5
        jmp    pGo

        for    7
        dat    0,0
        rof

     qf equ qKil
     qs equ (-250)
     qd equ (-125)
     qi equ 7
     qr equ 11

qGo: seq   qd+qf+qs,    qf+qs
     djn.f qSki,        {qd+qf+qs+qi
     seq   qd+qf+6*qs,  qf+6*qs
     djn.f qFas,        {qd+qf+6*qs+qi
     seq   qd+qf+5*qs,  qf+5*qs
     jmp   qFas,        <qBmb
     seq   qd+qf+7*qs,  qf+7*qs
     jmp   qFas,        >qBmb
     seq   qd+qf+9*qs,  qf+9*qs
     djn   qFas,        {qFas
     seq   qd+qf+10*qs, qf+10*qs
     jmp   qFas,        {qFas
     seq   qd+qf+3*qs,  qf+3*qs
     djn.f >qFas,       {qd+qf+3*qs+qi
     seq   qd+qf+2*qs,  qf+2*qs
     jmp   >qFas,       {qSlo
     seq   qd+qf+4*qs,  qf+4*qs
     jmp   >qFas,       }qSlo
     seq   qd+qf+12*qs, qf+12*qs
     jmp   qSlo,        {qSlo
     seq   qd+qf+15*qs, qf+15*qs
     jmp   qSlo,        <qBmb
     seq   qd+qf+21*qs, qf+21*qs
     jmp   qSlo,        >qBmb
     seq   qd+qf+24*qs, qf+24*qs
     jmp   qSlo,        }qSlo
     seq   qd+qf+27*qs, qf+27*qs
     djn   qSlo,        {qFas
     seq   qd+qf+30*qs, qf+30*qs
     jmp   qSlo,        {qFas
     sne   qd+qf+18*qs, qf+18*qs
     jmz.f xGo,         qd+qf+18*qs-10

qSlo:mul.ab #3,         qKil
qFas:mul.b qBmb,        @qSlo
qSki:sne   >594,        @qKil
     add   #qd,         qKil
qLoo:mov   *qKil,       @qKil
qKil:mov   qBmb,        *qs
     sub   #qi,         qKil
     djn   qLoo,        #qr
     djn.f xGo,         <10
qBmb:dat   {qi*qr-10,   {6

        end

