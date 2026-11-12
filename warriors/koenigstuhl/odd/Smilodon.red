;redcode-tiny
;name Smilodon
;author Simon Wainwright
;strategy stone & imps
;assert 1 || CORESIZE==800
 
        papboot      equ             666
        impstep      equ             267
 
        spl            1,           <250
        spl            1,           <350
        spl        stone,           <450
        mov       {paper,        {papjmp
papjmp  djn.f    papboot,           <550
 
paper   spl           @4,     >impstep+1
        mov       }paper,         >paper
        spl    impstep*7,          <-150
imp     mov.i         #1,        impstep
 
        dat            0,              0
        dat            0,              0
gate    dat            0,              0
        dat            0,              0
 
        stonestep    equ             235
 
stone   spl   #stonestep,    <-stonestep
loop    mov   {stonestep,    2-stonestep
        add        stone,           loop
        djn.f       loop,          <-300
clear   mov       squash,          >gate
        djn.f      clear,          {gate
squash  dat            1,             10
 
        end
