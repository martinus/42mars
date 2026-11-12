;redcode-94nop quiet
;name Garlic
;author Roy van Rijn
;strategy As usual, a stone/paper
;strategy This time tweaked to be a little bit anti-vampire
;assert 1

wGo     spl     1
        spl     1
        spl     1

cStep1  equ     1313
cStep2  equ     2900
cStep3  equ     4129

bStep1  equ     7482

pStart  spl     @0              , >cStep1
        mov.i   }-1             , >-1
        spl     cStep2          , 0
        mov.i   >-1             , }-1
        mov.i   pBomb           , }bStep1 ;bomb a-field
        mov.i   <-3             , <1
        djn.f   @0              , >cStep3
pBomb   mov.i   #0              , }0 ;if we hit a pit, clear it

sOff    equ     2577

bBoot   mov     sStart  , sOff-6-CURLINE
mov     sBmb    , sOff+hOff-CURLINE
        spl     2       , >2406
        spl     2       , >2838
sDst    spl     1       , sOff-CURLINE
        mov     <sSrc   , <sDst
        djn     @bBoot  , #5
sSrc    jmp     wGo     , sBmb

hStep equ    3039
hTime equ    3360
hDjn  equ    7603
hOff  equ    6864

sStart spl    #0               , 0
       mov    sBmb+hOff        , @hPtr
hHit   add    #hStep*2         , hPtr
hPtr   mov    sBmb+hOff        , }hHit-hStep*hTime
       djn.f  -3               , <hDjn
sBmb   dat    #hStep           , >1

end bBoot
