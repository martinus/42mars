;redcode-94
;name CSEC
;author Miz
;assert 1

PIN 13

; Why should i spend time trying to make
; something myself? Fooling around with
; pspace would drive me crazy, and
; i doubt that Nenad will use it

pStep1  equ    561
bStep1  equ    4633

sAway   equ    4854
pAway   equ    562

wGo     mov     hBomb           , wGo+sAway+6+hOff
        spl     2               , {1000
qtab2   spl     1               , <2000
        spl     1               , {3000
        mov     <dGo            , <dBoo
        mov     {pEnd           , {pBoo
dBoo    spl     @0              , wGo+sAway+6
        spl     @-1             , <3326;6121
pBoo    djn.f   wGo+pAway+6     , <7851;6824

for     13
        dat     0               , 0
rof

hStep   equ    3039
hTime   equ    3360
hDjn    equ    2813
hOff    equ    5

;John Metcalf! Chip Wendell!

dGo     spl     #0              , 6
        mov     hBomb+hOff      , @hPtr
hHit    add     #hStep*2        , hPtr
hPtr    mov     hBomb+hOff      , }hHit-hStep*hTime
        djn.f   -3              , <hDjn
        dat     0               , 0
hBomb   dat     hStep           , >1

for     13
        dat     0               , 0
rof

pGo     spl    pStep1,          {3
        mov    }2,              }-1
        mov    pBmb,            >bStep1
        mov    3,               }-3
        jmz.f  -4,              *-1
pBmb    dat    <5334,           <2667
pEnd    dat    0,               0

end wGo

