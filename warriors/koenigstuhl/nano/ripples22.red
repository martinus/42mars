;redcode-nano
;name ripples 22
;author S.Fernandes
;strategy paper
;assert CORESIZE == 80

pstep   equ     -22
ipos    equ     -34
cpos    equ     17
dpos    equ     -29

        mov     >-38        ,    25
paper   spl     #0          ,    <pstep
        mov     }paper      ,    >paper
        mov     >ipos       ,    <cpos
        djn.f   *pstep-2    ,    <dpos
        end

