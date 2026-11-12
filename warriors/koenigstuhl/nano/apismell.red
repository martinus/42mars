;redcode-nano
;name Apis Mellifera
;author S.Fernandes
;strategy paper/clear
;assert CORESIZE == 80

pstep   equ     -22
cpos    equ     -18
dpos    equ     -8

paper   spl     #0          ,    <33
        mov     }paper      ,    }pboot
pboot   spl     <pstep      ,    <-16
        mov.i   #1          ,    <1
        djn     paper+1     ,    #dpos
        end
