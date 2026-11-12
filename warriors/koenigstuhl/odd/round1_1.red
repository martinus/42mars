;redcode-94nop
;name From the Grave
;author Roy van Rijn
;strategy continuously booted LP paper
;assert 1

;39741

pStep   equ     1310
bStep1  equ     5295
bOff1   equ     7453
bOff2   equ     6187
bDist   equ     2740
bIncr   equ     1407
pDjn    equ     3972
bDjn    equ     4232

pLen    equ     8

; LP paper with embedded stone
pTop    spl   @pStep    , >pLen
        sub.x pEnd      , @3
pBmb    mov.i {bOff1    , {bOff2
        mov   <pTop     , {pTop
        mov   <pTop     , {pTop
pLoop   add.x #bStep1   , pBmb
        jmn.b -4        , @-2
pEnd    djn.f pTop      , <pDjn

for 10
dat 0,0
rof

; Continuously boot the paper:
bTop    add.f #bIncr     , *8
wGo     mov.i <bBoot    , {bBoot
        mov.i <bBoot    , {bBoot
        mov.i <bBoot    , {bBoot
        mov.i <bBoot    , {bBoot
        mov.i <bBoot    , {bBoot
        mov.i <bBoot    , {bBoot
bBoot   spl   bDist     , pTop+pLen
        mov.i <bBoot    , {bBoot
        mov.i <bBoot    , {bBoot
        djn.f bTop      , {bDjn

end wGo
