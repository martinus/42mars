;redcode-94nop
;name Pijl
;author Roy van Rijn
;strategy (Pijl is Dutch for Arrow)
;strategy Its Arrow turned into a bombing scanner!
;strategy The trick bombing trick it widely used in oneshots, but not really in scanners
;strategy Also I've updated all the constants (to make it a bit different from Arrow)
;assert 1

sStep   equ    7982
sHit    equ    14

sTrain  equ    973
cGate   equ    (sHead-2)

pBoot   equ    5900

zero    equ     qbomb

qtab3   equ     qbomb
qbomb   dat     >qoff           , >qc2
cBmb    dat     <2667           , {16

bPtr    dat     cLoo+3          , <qb1
qtab2   dat     cLoo+3+pBoot+1  , <qb2
pGo     spl     1               , <qb3

   for 6
       mov.i   {bPtr           , {qtab2
   rof
       djn     sScan+pBoot-1   , #1
       mov.i   cBmb            , cLoo+3+pBoot+1

for     4
       dat     0               , 0
rof

       dat    zero-1           , qa1
qtab1   dat    zero-1           , qa2

sHead   mov    }sFlag           , >3770
sWip    mov    *sAdd            , >sHead
sAdd    add.f  step             , sScan
       mov.i  cLoo+3           , *sScan
sScan   sne    }2*sStep+8-2667  , 2*sStep
sFlag   djn.f  sAdd             , <sTrain
       mov.b  sScan            , @sWip
       djn    {sFlag           , #sHit
step    spl    #sStep           , sStep
cLoo    mov    cLoo+3           , >cGate
       djn.f  cLoo             , >cGate

for     35
       dat     0               , 0
rof

qc2     equ ((1+(qtab3-qptr)*qy)%CORESIZE)
qb1     equ ((1+(qtab2-1-qptr)*qy)%CORESIZE)
qb2     equ ((1+(qtab2-qptr)*qy)%CORESIZE)
qb3     equ ((1+(qtab2+1-qptr)*qy)%CORESIZE)
qa1     equ ((1+(qtab1-1-qptr)*qy)%CORESIZE)
qa2     equ ((1+(qtab1-qptr)*qy)%CORESIZE)
qz      equ 2108
qy      equ 243         ;qy*(qz-1)=3D1


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
       jmz.f   pGo             , qptr+(qz+1)*(qb2-1)+(qb2-1)


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
       djn.f   pGo             , {451


end qgo

