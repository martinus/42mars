;redcode-tinylp
;name swallow
;author John Metcalf
;strategy qscan (dat bomb) -> imp spiral / clear
;assert 1
;       CORESIZE==800 && MAXPROCESSES==8
; benchmark - 50%w 27%l 23%t = 173 points

     org qGo

     istep equ 267
     iboot equ imp+60

bbb: mov   @0,            <-40
     jmp   {0,            }0

pGo: mov   imp,           iboot
     spl   b,             <iboot+istep-25
     spl   ab,            <iboot-istep-25
     spl   aab,           <iboot+istep-50
     jmp   iboot+istep*0, <iboot-istep-50
aab: jmp   iboot+istep*1, <iboot+istep-75
ab:  spl   abb,           <iboot-istep-75
     jmp   iboot+istep*2, <iboot+istep-100
abb: jmp   iboot+istep*3, <iboot-istep-100
b:   spl   bb,            <iboot+istep-125
     spl   bab,           <iboot-istep-125
     jmp   iboot+istep*4, <iboot+istep-150
bab: jmp   iboot+istep*5, <iboot-istep-150
bb:  spl   bbb,           <iboot+istep-175
     jmp   iboot+istep*6, <iboot-istep-175
imp: mov.i #0,            istep

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
qBmb:dat   #qi*qr-7,    {6         ; B=6
     end

