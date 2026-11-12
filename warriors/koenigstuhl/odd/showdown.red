;redcode-odd
;name Showdown at Thunder Road
;author John Metcalf
;strategy MiniQ^3 -> Paper
;assert 1
;       CORESIZE==2310

     org   qGo

pGo: spl   1,           <-291
     spl   1,           <-391
     spl   1,           <-491
pap2:spl   948,         0
     mov   >pap2,       }pap2
     mov   bomb,        <1459
     mov   bomb,        <1223
     mov   bomb,        <1777
     mov   <pap2,       {pap3
pap3:jmz   649,         *0
bomb:dat   <1,          {1

     for   4
     dat   0,0
     rof

     qf equ qKil                   ; Mini-Q^3
     qs equ 102
     qd equ 51
     qi equ 5
     qr equ 9

qGo: seq   qd+qf+qs,    qf+qs      ; 1
     djn.f qSki,        {qd+qf+qs+qi
     seq   qd+qf+6*qs,  qf+6*qs    ; B
     djn.f qFas,        {qd+qf+6*qs+qi
     seq   qd+qf+5*qs,  qf+5*qs    ; B-1
     jmp   qFas,        <qBmb
     seq   qd+qf+7*qs,  qf+7*qs    ; B+1
     jmp   qFas,        >qBmb
     seq   qd+qf+9*qs,  qf+9*qs    ; A-1
     djn   qFas,        {qFas
     seq   qd+qf+10*qs, qf+10*qs   ; A
     jmn   qFas,        {qFas

     seq   qd+qf+3*qs,  qf+3*qs    ; C
     djn.f >qFas,       {qd+qf+3*qs+qi
     seq   qd+qf+2*qs,  qf+2*qs    ; C-1
     jmn   >qFas,       {qSlo
     seq   qd+qf+4*qs,  qf+4*qs    ; C+1
     jmn   >qFas,       }qSlo
     seq   qd+qf+12*qs, qf+12*qs   ; B*C-B
     jmn   qSlo,        {qSlo
     seq   qd+qf+15*qs, qf+15*qs   ; B*C-C
     jmp   qSlo,        <qBmb
     sne   qd+qf+18*qs, qf+18*qs   ; B*C
     jmz.f pGo,         qd+qf+18*qs-10

qSlo:mul   #3,          qKil       ; C=3
qFas:mul.b qBmb,        @qSlo
qSki:sne   >qf+23*qs,   >qKil
     add   #qd,         qKil
qLoo:mov   *qKil,       <qKil
qKil:mov   qBmb,        }qs
     sub   #qi-1,       @qLoo
     djn   qLoo,        #qr
     djn.f pGo,         <10        ; A=10
qBmb:dat   {qi*qr-7,    {6         ; B=6
     end
