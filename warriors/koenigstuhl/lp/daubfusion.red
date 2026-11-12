;redcode-lp
;name DaubFusion
;author Roy van Rijn
;assert 1

zero    equ     qbomb

qtab3   equ     qbomb
qbomb   dat     >qoff           , >qc2
        dat     0               , 0

pGo     spl     s1              , <qb1
qtab2   spl     p1              , <qb2
        spl     s2              , <qb3
        spl     p2              , >0

        spl     4               , }6699
        spl     2               , >92
        jmp     imp             , {719
        jmp     imp+2667        , {3476
        spl     2               , }5592
        jmp     imp+5334        , >6318
        jmp     imp+8001        , <7862

for     4
        dat     0               , 0
rof

        dat    zero-1           , qa1
qtab1   dat    zero-1           , qa2

for     2
        dat     0               , 0
rof

      mov #7, #7
p1    mov <-1, <4
      mov 4,{1088
      jmn -2, @-3
      spl @-4, {5433
      jmz.b @0,6587
      dat >1, <1

for 8
dat 0,0
rof

      mov #7, #7
p2    mov <-1, <4
      mov 4,{3012
      jmn -2, @-3
      spl @-4, }3391
      jmz.b @0,4541
      dat >1,<1

for 2
dat 0,0
rof

sStep   equ     4343
s1      mov     {1990,1-sStep
        sub.x   #sStep   ,-1
        jmp     -2       ,}-2

for 2
dat 0,0
rof

away2   equ     s2+2348

s2      mov     stone2  , away2
        mov     stone2+1, away2+1
        mov     stone2+2, away2+2
        djn.f   away2   , {0

sStep2  equ     6393
stone2  mov     {2444,1-sStep2
        sub.x   #sStep2  ,-1
        jmp     -2       ,}-2


for 4
dat 0,0
rof


qc2     equ ((1+(qtab3-qptr)*qy)%CORESIZE)
qb1     equ ((1+(qtab2-1-qptr)*qy)%CORESIZE)
qb2     equ ((1+(qtab2-qptr)*qy)%CORESIZE)
qb3     equ ((1+(qtab2+1-qptr)*qy)%CORESIZE)
qa1     equ ((1+(qtab1-1-qptr)*qy)%CORESIZE)
qa2     equ ((1+(qtab1-qptr)*qy)%CORESIZE)
qz      equ 2108
qy      equ 243         ;qy*(qz-1)=1


;q0 mutation
qgo     sne     qptr+qz*qc2     , qptr+qz*qc2+qb2
        seq     <qtab3          , qptr+qz*(qc2-1)+qb2
        jmp     q0              , }q0
        sne     qptr+qz*qa2     , qptr+qz*qa2+qb2
        seq     <qtab1          , qptr+qz*(qa2-1)+qb2
        jmp     q0              , {q0
        sne     qptr+qz*qa1     , qptr+qz*qa1+qb2
        seq     <(qtab1-1)      , qptr+qz*(qa1-1)+qb2
        djn.a   q0              , {q0
                                        ;q1 mutation
        sne     qptr+qz*qb3     , qptr+qz*qb3+qb3
        seq     <(qtab2+1)      , qptr+qz*(qb3-1)+(qb3-1)
        jmp     q0              , }q1
        sne     qptr+qz*qb1     , qptr+qz*qb1+qb1
        seq     <(qtab2-1)      , qptr+qz*(qb1-1)+(qb1-1)
        jmp     q0              , {q1

        sne     qptr+qz*qb2     , qptr+qz*qb2+qb2
        seq     <qtab2          , qptr+qz*(qb2-1)+(qb2-1)
        jmp     q0
                                        ;qz mutation
        seq     >qptr           , qptr+qz+(qb2-1)
        jmp     q2              , <qptr
                                        ;q0 mutation
        seq     qptr+(qz+1)*(qc2-1),qptr+(qz+1)*(qc2-1)+(qb2-1)
        jmp     q0              , }q0
        seq     qptr+(qz+1)*(qa2-1),qptr+(qz+1)*(qa2-1)+(qb2-1)
        jmp     q0              , {q0
        seq     qptr+(qz+1)*(qa1-1),qptr+(qz+1)*(qa1-1)+(qb2-1)
        djn.a   q0              , {q0
        jmz.f   pGo           , qptr+(qz+1)*(qb2-1)+(qb2-1)

qoff    equ     -86
qstep   equ     -7
qtime   equ     19

q0      mul.b   *2              , qptr
q2      sne     {qtab1          , @qptr
q1      add.b   qtab2           , qptr
        mov     qtab3           , @qptr
qptr    mov     qbomb           , }qz
        sub     #qstep          , qptr
        djn     -3              , #qtime
        djn.f   pGo             , #0

imp     mov.i   #0              , 2667

end qgo
