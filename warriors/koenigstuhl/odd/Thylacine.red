;redcode-tiny
;name Thylacine
;author Simon Wainwright
;strategy stone & imps
;assert 1 || CORESIZE==800
 
        papboot      equ             666
        impstep      equ             267
 
        spl            1,           <350
        spl            1,           <450
        spl        stone,           <250
        mov       {paper,        {papjmp
papjmp  djn.f    papboot,           <350
 
paper   spl           @4,      impstep+1
        mov       }paper,         >paper
        spl    impstep*6,           <-50
imp     mov.i   #impstep,        impstep
 
        for            7
        dat            0,              0
        rof
 
        stonestep    equ             515
 
stone   spl   #stonestep,    <-stonestep
loop    mov   >stonestep,    1-stonestep
        add        stone,           loop
        djn.f       loop,          <-200
        end
