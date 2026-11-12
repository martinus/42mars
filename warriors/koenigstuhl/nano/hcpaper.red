;redcode-nano
;name hand coded paper
;author S.Fernandes
;strategy paper
;assert CORESIZE == 80

pstep   equ     15
ipos    equ     40
cpos    equ     -5
dpos    equ     35

        mov     >60         ,    10
paper   spl     #0          ,    <pstep
        mov     }paper      ,    >paper
        mov     >ipos       ,    <cpos
        djn.f   *pstep-2    ,    <dpos
        end

