;redcode-94nop
;name SimpleShot
;author Roy van Rijn
;strategy -8/8 bombing oneshot with SSD
;assert 1

;People might have a lot of 'boot' code, building values
;So maybe speed wins?

        ; setup values:

        mul.x @4        , *iClr
        mul.a *iClr     , *iClr
scan    sub.f *iClr     , @2    ;bombing oneshot
        mov.i *iClr     , }gate
        jmz.f -2        , @gate
iClr    jmp   clear     , 0

        dat 0,0
        dat 0,0
        dat 0,0
        dat 0,0
        dat 0,0

gate    dat   8         , 8
        dat   1         , 8
clear   spl   #7        , 7
        mov.i *gate+1   , >gate
        mov.i *gate+1   , >gate
        djn.f -2        , }clear

end scan-2
