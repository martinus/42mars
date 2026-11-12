;redcode-94x
;name Arrow X
;author Christian Schmidt
;strategy scanner
;assert 1

sStep   equ    4927
sHit    equ    45
sTrain  equ    50302
cGate   equ    (sHead-2)

sHead   mov    }sFlag,     >1800
sWip    mov    *sAdd,      >sHead
sAdd    add.f  step,       sScan
sScan   sne    }2*sStep+8, 2*sStep
sFlag   djn.f  sAdd,       <sTrain
        mov.b  sScan,      @sWip
        djn    {sFlag,     #sHit
step    spl    #sStep,     sStep
cLoo    mov    cBmb,       >cGate
        djn.f  cLoo,       >cGate
cBmb    dat    <1,      2-cGate

end sScan

