;redcode-PW
;name Windshield Wiper
;author Chip Wendell
;strategy Paper/Stone, taken from Hullabaloo
;strategy  plus the shorter qscan from Reepicheep
;strategy  with an extra brainwashing line in the stone
;strategy For the quarterfinal round of CSET2005
;assert 1

	pin 13

pStep1  equ    561
bStep1  equ    4633

sAway   equ    4854
pAway   equ    562

zero    equ     qbomb

qtab3   equ     qbomb
qTab1	equ	pBoo
;qbomb   dat     >qoff           , >qc2

wGo     mov     hBomb           , wGo+sAway+6+hOff
        spl     }2              , <qC
qTab2   spl     1               , <qD
        spl     0               , <qE
        mov     <dGo            , <dBoo
        mov     {pEnd           , {pBoo
dBoo    spl     @0              , wGo+sAway+6
        spl     @-1             , <qA
pBoo    djn.f   wGo+pAway+6     , <qB


hStep   equ    3039
hTime   equ    3360
hDjn    equ    2813
hOff    equ    5

dGo     spl     #0              , 6
        mov     hBomb+hOff      , @hPtr
hHit    add     #hStep*2        , hPtr
hPtr    mov     hBomb+hOff      , }hHit-hStep*hTime
	stp.b	>-4,-4
        djn.f   -4              , <hDjn
hBomb   dat     hStep           , >1

        dat     0               , 0
        

pGo     spl    pStep1,          {3
        mov    }2,              }-1
        mov    pBmb,            >bStep1
        mov    3,               }-3
        jmz.f  -4,              *-1
pBmb    dat    <5334,           <2667
pEnd    dat     0               , 0

        qX      equ     3080
        qA      equ     3532
        qB      equ     2051
        qC      equ     6177
        qD      equ     4696
        qE      equ     3215
        qF      equ     583

        qStep   equ     5
        qTime   equ     11
        qOff    equ     47

qBomb   dat     {qOff   , qF

qGo     sne     qPtr+qX*qE      , qPtr+qX*qE+qE
        seq     <qTab2+1        , qPtr+qX*(qE-1)+(qE-1)
        jmp     qDec            , }qDec+2
        sne     qPtr+qX*qF      , qPtr+qX*qF+qD
        seq     <qBomb          , qPtr+qX*(qF-1)+qD
        jmp     qDec            , }qDec
        sne     qPtr+qX*qA      , qPtr+qX*qA+qD
        seq     <qTab1-1        , qPtr+qX*(qA-1)+qD
        djn.a   qDec            , {qDec
        sne     qPtr+qX*qB      , qPtr+qX*qB+qD
        seq     <qTab1          , qPtr+qX*(qB-1)+qD
        djn.a   qDec            , *0
        sne     qPtr+qX*qC      , qPtr+qX*qC+qC
        seq     <qTab2-1        , qPtr+qX*(qC-1)+(qC-1)
        jmp     qDec            , {qDec+2
        sne     qPtr+qX*qD      , qPtr+qX*qD+qD
        jmz.f   wGo           , <qTab2

qDec    mul.b   *2      , qPtr
qSkip   sne     <qTab1  , @qPtr
        add.b   qTab2   , qPtr
qLoop   mov     qBomb   , @qPtr
qPtr    mov     qBomb   , }qX
        sub     #qStep  , @qSkip
        djn     qLoop   , #qTime
        djn.f   wGo   , #0
end qGo

