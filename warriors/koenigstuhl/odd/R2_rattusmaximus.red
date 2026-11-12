;redcode-nano
;name Rattus Maximus
;author S.Fernandes
;strategy paper/imp for CGM round 2
;       CORESIZE == 160
;assert 1

pstep   equ     59
ipos    equ     126
cpos    equ     97
dpos    equ     49

        mov     >131        ,    25
paper   spl     #0          ,    <pstep
        mov     }paper      ,    >paper
        mov     *ipos       ,    <cpos
        djn.f   *pstep-2    ,    <dpos
        mov.i   #1          ,    1

        end


