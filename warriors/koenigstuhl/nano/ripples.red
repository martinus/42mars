;redcode-nano
;name ripples in space-time
;author S.Fernandes
;strategy paper
;assert CORESIZE == 80

pstep   equ     -17
ipos    equ     10
cpos    equ     -33
dpos    equ     36

        mov     >-39        ,    25
paper   spl     #0          ,    <pstep
        mov     }paper      ,    >paper
        mov     >ipos       ,    <cpos
        djn.f   *pstep-2    ,    <dpos
        end

