;redcode-94nop
;name Blue Pike
;author Roy van Rijn
;strategy stone/paper both stolen :(
;strategy Stone from Quicksilver and Paper from Reepicheep
;assert 1

pHit0   equ     7599
pDst0   equ     535
pDst1   equ     3875
pDst2   equ     5160

pGo     spl     1       , <2463
qTab2   spl     1       , <2456
        spl     1       , <2645

pSilk0  spl     @0      , >pDst0
        mov     }pSilk0 , >pSilk0
pSilk1  spl     pDst1   , 0
        mov     >pSilk1 , }pSilk1
        mov     pBmb    , >pHit0
        mov     <pSilk1 , <pSilk2
pSilk2  djn.f   @0      , >pDst2
pBmb    dat     >5334   , >2667

for 25
        dat 0,0
rof

hStep equ    3039
hTime equ    3360
hDjn  equ    2813
hOff  equ    5
sOff  equ    5941

qX    equ    2922
qA    equ    5673
qB    equ    1154
qC    equ    787
qD    equ    4268
qE    equ    7749
qF    equ    1825

qStep equ    7
qTime equ    16
qOff  equ    87

bBoot   mov     stone   , sOff-6-CURLINE
        mov     hBomb   , sOff+5-CURLINE
        spl     2       , <2667
qTab1   spl     2       , <2667
sDst    spl     1       , sOff-CURLINE
        mov     <sSrc   , <sDst
        djn     @bBoot  , #5
sSrc    jmp     pGo     , hLoo+1

stone spl    #0               , 0
hLoop mov    hBomb+hOff       , @hPtr
hHit  add    #hStep*2         , hPtr
hPtr  mov    hBomb+hOff       , }hHit-hStep*hTime
hLoo  djn.f  hLoop            , <hDjn
hBomb dat    hStep            , >1
end   bBoot

