;redcode-nano
;name Bombus Maximus
;author S.Fernandes
;strategy clear/imp for CGM round 2
;       CORESIZE == 160
;assert 1

        org    start

cpos    equ     129
dpos    equ     87

ptr     spl    #13   ,  }ptr-2
clr     mov    ptr-2 ,  }ptr
        mov    ptr-2 ,  {cpos
        djn.f  clr   ,  {dpos
start   spl    ptr   ,  <143
        mov.i  #1    ,  1

        end
