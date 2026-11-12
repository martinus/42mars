;redcode-tiny
;name Cloudrunner
;author Simon Wainwright
;strategy stone & imps
;assert 1 || CORESIZE==800
 
        papboot      equ             686
        impstep      equ             267
 
        mov       squash,          *loop
        spl            1,           <250
        spl            1,           <350
        mov       <paper,        {papjmp
        spl        stone,           <450
papjmp  djn.f    papboot,           <550
 
paper   spl    impstep+1,              4
        mov       >paper,         }paper
        spl    impstep*2,          <-160
imp     mov.i   #impstep,             *0
 
squash  dat          >-1,             >1
 
        dat            0,              0
        dat            0,              0
        dat            0,              0
        dat            0,              0
        dat            0,              0
 
        stonestep    equ             252
 
stone   spl           #0,              0
loop    mov    stonestep,    1-stonestep
        sub.ab        {0,             }0
        djn.f       loop,           <170
 
        end
