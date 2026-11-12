;redcode-94nop
;name Myrmidon
;author Roy van Rijn
;strategy Bombing oneshot
;assert 1

ptr     mov     sDiff,  1
sw      dat     1,      18
g2      spl     #24,    18

for 3
        dat     0,      0
rof

sOff    equ     11
sStep   equ     504
sDiff   equ     -16

sGo     add.f   clr,    sScan
        mov     ptr,    *1
sScan   sne     *sOff,  >(sOff+sDiff)-7
        djn.f   sGo,    @-1
        add.b   sScan,  ptr
clr     spl     #sStep, sStep
        mov     *sw,    >ptr
        mov     *sw,    >ptr
        djn.f   -2,     }g2

end sGo
