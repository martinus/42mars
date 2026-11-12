;redcode-94nop
;name Eccentric (NQS)
;author Roy van Rijn
;strategy stone + clear + imps
;assert 1

hDist   equ     4174
iDist   equ     hDist-1672
cDist   equ     hDist-5279
cOff    equ     1050
sStep   equ     1653

        dat     0               , 0
sBoot   mov     sBmb            , hBoot+hDist+5
        spl     2
qtab2   spl     2
        spl     1
        mov     {sBoot          , {hBoot
        mov     <iBoot          , {iBoot
        mov     {cIncr          , <cBoot
hBoot   djn     hDist           , #5
bBoot   mov     cGate           , cBoot+cDist-10
iBoot   spl     hBoot+iDist     , #iImp+1
cBoot   jmp     cDist-5         , cDist

for     10
        dat     0               , 0
rof

iStep   equ     2667
iPmp    spl     #iImp           , >-20
        sub.f   #-iStep-1       , iJmp
        mov     iImp            , }iPmp
iJmp    jmp     iImp-2*(iStep+1), >iImp+2*iStep-1
iImp    mov.i   #1              , iStep

for     3
        dat     0               , 0
rof

sStart  spl     #3*sStep        , 3*sStep
        mov     sBmb+5          , @sPtr
        add     sStart          , @-1
sPtr    mov     4+(2*sStep)     , *4
        djn.f   -3              , *sPtr
sBmb    dat     {sStep          , >1

for     3
        dat     0               , 0
rof

cGate   dat     cOff, cOff+18
cIncr   spl.f   #cBomb+2,<1956
        mov.i   @cBomb,  }-6
        djn.f   -1,      <-7
cBomb   dat     #9,      {1
        spl     #8,      {-85

end sBoot
