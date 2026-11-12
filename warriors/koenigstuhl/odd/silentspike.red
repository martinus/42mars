;redcode-odd
;name Silent Spike
;author Roy van Rijn
;assert 1

;Different steps for smaller version
for (CORESIZE==800)
        sStep  equ     357
        sGap   equ     -7
        sOff   equ     -65
        sDjn   equ     -627
rof

for (CORESIZE==8000)
        sStep  equ     48820
        sGap   equ     -14
        sOff   equ     27669
        sDjn   equ     32770
rof

for (CORESIZE==55440)
        sStep  equ     32098
        sGap   equ     -15
        sOff   equ     6135
        sDjn   equ     -627
rof

        add.f   sAdd    , @sInd
sPtr    sne.i   }sOff   , >sOff+sGap

for (CORESIZE==8000) || (CORESIZE==55440)
        add.f   sAdd    , @sInd
        sne.i   *sPtr   , @sPtr
rof
for (CORESIZE==55440)
        add.f   sAdd    , @sInd
        sne.i   *sPtr   , @sPtr
rof
        djn.f   sPtr-1  , <sDjn

sAdd    spl     #sStep  , {sStep
        mov.i   @2      , >sPtr
sInd    mov.i   @1      , >sPtr
        djn.f   -2      , {bomb

        dat     }-181   , }(bomb-sPtr)+2
bomb    spl     #-181   , }(bomb-sPtr)+2

end sPtr
