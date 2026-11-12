;redcode-odd
;name Triggerfinger
;author Roy van Rijn
;strategy oneshot
;assert 1

;Different steps for smaller version
for (CORESIZE==800)
        sStep  equ     357
        sGap   equ     16
        sOff   equ     44
rof

for (CORESIZE==8000) || (CORESIZE== 55440)
        sStep  equ     3434
        sGap   equ     16
        sOff   equ     6147
rof

sPtr    dat     sOff,   sOff-sGap
        dat     0,      0
        dat     0,      0

sw      dat     1,      (tail-sPtr)+2
g2      spl     #24,    (tail-sPtr)+2

        dat     0,      0

sGo     add.f   clr,    sPtr
        sne     *sPtr,  @sPtr
;Extra scanning for larger warrior
for (CORESIZE==8000) || (CORESIZE== 55440)
        add.f   clr,    sPtr
        sne     @sPtr,  *sPtr
rof
;Even more speed for larger warrior
for (CORESIZE== 55440)
        add.f   clr,    sPtr
        sne     @sPtr,  *sPtr
        add.f   clr,    sPtr
        sne     @sPtr,  *sPtr
rof
        djn.f   sGo,    @sPtr

clr     spl     #sStep, >sStep
        mov     *sw,    >sPtr
        mov     *sw,    >sPtr
tail    djn.f   -2,     }g2

end sGo+1
