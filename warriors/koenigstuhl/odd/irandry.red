;redcode-rf22
;name I, randry
;author Sascha Zapf
;strategy qscan and paper
;assert 1

;optimax 123
;optimax work iran
;optimax suite 22bench
;optimax rounds 1 200 100

;optimax phase2 22bench/pap/skinner.red
;optimax phase2 10
;optimax phase2 0%

;optimax phase3 10
;optimax phase3 0%
;optimax phase3 top10
;optimax phase3 22.lst

; [ QSCAN ]

st     sne.x qf+592,   qf+656 ; scan
     seq.x qf+176,   qf+752
     djn.f @qlo+1,   @qlo+1
     sne.x qf+500,   qf+475
     seq.x qf+700,   }qf
     jmp   @qlo+1,   {qf
     sne.x qf+550,   qf+125
     jmz.f pGo,      <qf

qf:  mul.x #300,     #625   ; decode
     jmz.f @qlo+1,   >qf

qlo: mov   {519,     >qf    ; attack
     mov   }qlo,     {qf
     seq   {qf,      >qf
     djn.f qlo,      >qf
     jmp pGo, <707
     
     for 13
     dat 0,0
     rof
       


pStep1  equ   703;5229
pStep2  equ   469;3704
pAdd    equ   255;963
pOff    equ   (pHit+pAdd)

pRef    mov     #9,             #9
pGo     mov     <pRef,          <pBck
pPtr    mov     <pAdd,          }pOff
        add.ab  {0,             }0
pHit    mov     pBmb,           @pPtr
        jmn     pGo,            pRef
        spl     @pRef,          <pStep2
pBck    jmz     @0,             pStep1
pBmb    dat     }267,          >267


end st
