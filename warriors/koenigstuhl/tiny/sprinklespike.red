;redcode-tiny
;name Sprinkle Spike
;author Roy van Rijn
;assert CORESIZE==800

        sOff    equ        (CORESIZE/2)+((CORESIZE/80)*5)+2
        sDiff   equ        (CORESIZE/2)+21
        sGap    equ        16

        sStep   equ        30

sGo     add.f   sAdd     , @sInd
        mov.i   #sDiff   , {1
sPtr    sne     *sOff    , }(sOff+sDiff)-sGap
        djn.f   sGo      , <-1

sAdd    spl     #sStep+1 , {sStep+1
        mov.i   @2       , >sPtr
sInd    mov.i   @1       , >sPtr
        djn.f   -2       , {cBomb

        dat     }-123    , }(cBomb-sPtr)+2
cBomb   spl     #-123    , }(cBomb-sPtr)+2

end sPtr-1

