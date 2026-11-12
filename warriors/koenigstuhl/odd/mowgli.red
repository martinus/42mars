;redcode-94
;name Mowgli
;author LAchi
;strategy Clone of Hullabaloo by Roy
;assert 1

PIN 13

qoff    equ    -86
qb1     equ    1159
qb2     equ    1402
qb3     equ    1645
qa1     equ    -3196
qa2     equ    -2953
qc2     equ    673

pStep1  equ    561
bStep1  equ    4633

sAway   equ    4854
pAway   equ    562

zero    equ     qbomb

qtab3   equ     qbomb
qbomb   dat     >qoff           , >qc2

wGo     mov     hBomb           , wGo+sAway+6+hOff
        spl     }2              , <qb1
qtab2   spl     1               , <qb2
        spl     0               , <qb3
        mov     <dGo            , <dBoo
        mov     {pEnd           , {pBoo
dBoo    spl     @0              , wGo+sAway+6
        spl     @-1             , <3326;6121
pBoo    djn.f   wGo+pAway+6     , <7851;6824

for     7
        dat     0               , 0
rof
        dat    zero-1           , qa1
qtab1   dat    zero-1           , qa2

for     2
        dat     0               , 0
rof

hStep   equ    3039
hTime   equ    3360
hDjn    equ    2813
hOff    equ    5

dGo     spl     #0              , 6
        mov     hBomb+hOff      , @hPtr
hHit    add     #hStep*2        , hPtr
hPtr    mov     hBomb+hOff      , }hHit-hStep*hTime
        djn.f   -3              , <hDjn
        dat     0               , 0
hBomb   dat     hStep           , >1

        dat     0               , 0
        dat     0               , 0
        dat     0               , 0

pGo     spl    pStep1,          {3
        mov    }2,              }-1
        mov    pBmb,            >bStep1
        mov    3,               }-3
        jmz.f  -4,              *-1
pBmb    dat    <5334,           <2667
pEnd    dat    0,               0

end wGo

