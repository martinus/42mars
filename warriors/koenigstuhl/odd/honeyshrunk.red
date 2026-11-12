;redcode-94
;name Honey, I Shrunk the Warrior
;author Roy van Rijn
;assert 1

; Ok, very little time this week
; But I have to submit a warrior, so I dove into my archive
; Normally I would submit something unexpected
;
; Submitting Hullabaloo would be too obvious for example
; But thats just what I'm doing ;-)
; El kauka is known for its scanners, if he makes one I should have a chance
;
; I deleted almost all dats so it would fit into the 50 lines
; When I deleted the qscan I made it fit... but I want to have a qscan!!
; So I cut the qscan in half too... seems to work just fine :-)

PIN 13

pStep1  equ    561
bStep1  equ    4633

sAway   equ    4854
pAway   equ    562

zero    equ     qbomb

qtab3   equ     qbomb
qbomb   dat     >qoff           , >qc2

wGo     mov     hBomb           , wGo+sAway+6+hOff
        spl     }2              , }qb1
qtab2   spl     1               , }qb2
        spl     0               , }qb3
        mov     {pEnd           , {qtab1
        mov     <dGo            , <dBoo
dBoo    spl     @0              , wGo+sAway+6
        spl     @-1             , qa1
qtab1   djn.f   wGo+pAway+6     , qa2

for     2
        dat     0               , 0
rof

hStep   equ    5363
hTime   equ    6791
hDjn    equ    1284
hOff    equ    7746

dGo     spl     #0              , 6
        mov     hBomb+hOff      , @hPtr
hHit    add     #hStep*2        , hPtr
hPtr    mov     hBomb+hOff      , }hHit-hStep*hTime
        djn.f   -3              , {hDjn
        dat     0               , 0
hBomb   dat     {hStep          , >1

for     2
        dat     0               , 0
rof

pGo     spl    pStep1,          {3
        mov    }2,              }-1
        mov    pBmb,            >bStep1
        mov    3,               }-3
        jmz.f  -4,              *-1
pBmb    dat    <5334,           <2667
pEnd    dat    0,               0

        dat     0               , 0

qc2     equ ((1+(qtab3-qptr)*qy)%CORESIZE)
qb1     equ ((1+(qtab2-1-qptr)*qy)%CORESIZE)
qb2     equ ((1+(qtab2-qptr)*qy)%CORESIZE)
qb3     equ ((1+(qtab2+1-qptr)*qy)%CORESIZE)
qa1     equ ((1+(qtab1-1-qptr)*qy)%CORESIZE)
qa2     equ ((1+(qtab1-qptr)*qy)%CORESIZE)
qz      equ 2108 ;3592;2108
qy      equ 243  ;3511;243         ;qy*(qz-1)=1


;q0 mutation
qgo

        sne     qptr+qz*qa1     , qptr+qz*qa1+qb2
        seq     <(qtab1-1)      , qptr+qz*(qa1-1)+qb2
        djn.a   q0              , {q0

        sne     qptr+qz*qc2     , qptr+qz*qc2+qb2
        seq     <qtab3          , qptr+qz*(qc2-1)+qb2
        jmp     q0              , }q0

        sne     qptr+qz*qa2     , qptr+qz*qa2+qb2
        seq     <qtab1          , qptr+qz*(qa2-1)+qb2
        jmp     q0              , {q0
                                        ;q1 mutation
        sne     qptr+qz*qb3     , qptr+qz*qb3+qb3
        seq     <(qtab2+1)      , qptr+qz*(qb3-1)+(qb3-1)
        jmp     q0              , }q1


        jmz.f   wGo             , qptr+(qz+1)*(qb2-1)+(qb2-1)

qoff    equ     -87
qstep   equ     -7
qtime   equ     19

q0      mul.b   *2              , qptr
q2      sne     {qtab1          , @qptr
q1      add.b   qtab2           , qptr
        mov     qtab3           , @qptr
qptr    mov     qbomb           , }qz
        sub     #qstep          , qptr
        djn     -3              , #qtime
        jmp     wGo             , <3623
end qgo

