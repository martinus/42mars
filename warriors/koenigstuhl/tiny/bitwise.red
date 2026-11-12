;redcode-tiny
;name Bitwise
;author Roy van Rijn
;strategy Digital Swarms Qscan + Paper
;assert 1

     sne.x qf+592,   qf+656 ; scan
     seq.x qf+176,   qf+752
     djn.f @qlo+1,   @qlo+1
     sne.x qf+500,   qf+475
     seq.x qf+700,   }qf
     djn.b @qlo+1,   {qf
     sne.x qf+550,   qf+126
     jmz.f pgo,      <qf

qf:  mul.x #300,     #625   ; decode
     jmz.f @qlo+1,   >qf

qlo: mov   {519,     >qf    ; attack
     mov   }qlo,     {qf
     seq   {qf,      >qf
     djn.f qlo,      >qf

pgo  spl   }1,       {203
     spl   0,        {274

pGo  spl    183,     {2
     mov    }1,      }-1
     mov    *2,      }-2
     jmz.f  -3,      *-1

     end

