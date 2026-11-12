;redcode-nano
;name Ripple in the Equilibrium
;author S.Fernandes
;strategy paper
;assert CORESIZE == 80

pstep   equ     -19
ipos    equ     28
cpos    equ     -ipos
dpos    equ     11

        mov     {22         ,    39
paper   spl     #0          ,    <pstep
        mov     }paper      ,    >paper
        mov     >ipos       ,    <cpos
        djn.f   *pstep-2    ,    {dpos
        end

