;redcode-nano
;name ghoulish
;author S.Fernandes
;strategy paper/clear
;assert CORESIZE == 80

pstep   equ     -39
cpos    equ     -18
dpos    equ     27

paper   spl     #-21        ,    <-32
        mov     }paper-1    ,    }pboot
        mov.i   #1          ,    <1
pboot   spl     <pstep      ,    cpos
        djn.f   paper+1     ,    <dpos
        end
