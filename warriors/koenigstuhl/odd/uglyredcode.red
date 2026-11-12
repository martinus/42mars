;redcode-tinylp
;name ugly redcode
;author John Metcalf
;strategy qscan (jmp bomb) -> .5c lp scan
;assert 1
;       CORESIZE==800 && MAXPROCESSES==8

; benchmark - 48%w 36%l 16%t = 160 points

     org qGo

     step equ 151

ptr: add   #step,#bp+step
pGo: jmz.f ptr,  @ptr
     slt   ptr,  #5
     mov   *bp,  @ptr
     jmp   ptr,  <bp-step
bp:  dat   1,    1
     jmp   #2,   2

     for 11
     dat 0,0
     rof

     qf equ qKil
     qs equ 76
     qd equ 782
     qi equ 5
     qr equ 9

qGo: seq   qd+qf+qs,    qf+qs      ; 1
     djn.f qSki,        {qd+qf+qs+qi
     seq   qd+qf+2*qs,  qf+2*qs    ; C-1
     jmn   >qFas,       {qSlo
     seq   qd+qf+3*qs,  qf+3*qs    ; C
     djn.f >qFas,       {qd+qf+3*qs+qi
     seq   qd+qf+4*qs,  qf+4*qs    ; C+1
     jmn   >qFas,       }qSlo
     seq   qd+qf+5*qs,  qf+5*qs    ; B-1
     jmp   qFas,        <qBmb
     seq   qd+qf+6*qs,  qf+6*qs    ; B
     djn.f qFas,        {qd+qf+6*qs+qi
     seq   qd+qf+7*qs,  qf+7*qs    ; B+1
     jmp   qFas,        >qBmb
     seq   qd+qf+9*qs,  qf+9*qs    ; A-1
     djn   qFas,        {qFas
     seq   qd+qf+12*qs, qf+12*qs   ; B*C-B
     jmn   qSlo,        {qSlo
     seq   qd+qf+15*qs, qf+15*qs   ; B*C-C
     jmp   qSlo,        <qBmb
     sne   qd+qf+18*qs, qf+18*qs   ; B*C
     jmz.f pGo,         qd+qf+18*qs-10

qSlo:mul   #3,          qKil       ; C=3
qFas:mul.b qBmb,        @qSlo
qSki:sne   >400,        >qKil
     add   #qd,         qKil
qLoo:mov   *qKil,       <qKil
qKil:mov   qBmb,        }qs
     sub   #qi-1,       @qLoo
     djn   qLoo,        #qr
     djn.f pGo,         <10        ; A=10
qBmb:jmp   #qi*qr-7,    {6         ; B=6
     end

