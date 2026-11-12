;redcode-94t
;name Idiot
;author Roy van Rijn
;assert 1
;strategy Dumb warrior, see code and laugh :)
; identical to Moron [CCB]

zero    equ     qbomb

qtab3   equ     qbomb
qbomb   dat     >qoff           , >qc2

;Paper constants:
cstep1  equ    3137
nstep1  equ    705
tstep1  equ    1601

;Stone/Boot Constants
hStep   equ    6046
hTime   equ    2627
hDjn    equ    4277
hOff    equ    5
sOff    equ    1398

;Paper boot constants
pAw1   equ 5567
pAw2   equ 472

dat 0,0
dat 0,0

pGo     spl     1               , <qb1
qtab2   spl     1               , <qb2
        spl     1               , <qb3

      mov    {cp        , {pBo1
pBo1  spl    pEnd+pAw1  , {5747

      mov    {pEnd      , {pBo2
pBo2  jmp    pEnd+pAw2  , {4584

dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0

        dat     zero-1          , qa1
qtab1   dat     zero-1          , qa2
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
;Paper makes three copies and bombs (8x) with a anti-imp bomb
cp    spl    @pEnd      , <tstep1
      mov.i  }cp        , >cp
nothA spl    @nothA     , <cstep1
      mov.i  }nothA     , >nothA
      mov.i  bomb       , <641
      mov    {nothA     , {nothB
nothB djn.f  nstep1     , >4228
bomb  dat    <5334      , <2667
pEnd  dat    0          , 0

;Some spacing:
      for    11
      dat    0          , 0
      rof

;Pretty normal stone boot
bBoot   mov     stone   , sOff-6-CURLINE
        mov     hBomb   , sOff+5-CURLINE
        spl     2       , >2689
        spl     2       , >6562
sDst    spl     1       , sOff-CURLINE
        mov     <sSrc   , <sDst
        djn     @bBoot  , #5
sSrc    jmp     pGo     , hLoo+1

;And the normal quicksilver stone, just as it is...
stone   spl     #0      , 0
hLoop   mov     hBomb+hOff, @hPtr
hHit    add     #hStep*2  , hPtr
hPtr    mov     hBomb+hOff, }hHit-hStep*hTime
hLoo    djn.f   hLoop     , <hDjn
hBomb   dat     hStep     , >1


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
        jmz.f   pLogic          , qptr+(qz+1)*(qb2-1)+(qb2-1)

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

_RES EQU #0
_STRAT EQU #1
pLogic
result  ldp.ab _RES, wlt
strat   ldp.a _STRAT, choice
wlt     sne.ab #1, #0
        jmp win
        add.a #1, choice
        mod.a #4, choice
        stp.a choice, _STRAT
choice  jmp @0, bBoot
        nop 0, bBoot
        nop 0, tScan
        nop 0, tScan
win     mov.ab choice, #0
        mod.ab #2, win
        sub.ba win, choice
        jmp choice-1

for     166
        dat    0,0
rof

tPtr   dat    100 ,4100-4
       dat    0,0
       dat    0,0
       dat    0,0
       dat    0,0
       dat    0,0
       dat    0,0

tWipe  mov    tSpl     ,<tPtr
       mov    >tPtr    ,>tPtr
       jmn.f  tWipe    ,>tPtr

tScan  sub.x  #-14     ,tPtr
       sne.x  *tPtr    ,>tPtr
       sub.x  *pScan   ,@tScan
       jmn.f  tSelf    ,<tPtr
       jmz.f  tScan    ,*tPtr
pScan  mov.x  @tScan   ,@tScan
tSelf  slt.b  @tScan   ,#tEnd+4-tPtr
       djn    tWipe    ,@tScan
       djn    *pScan   ,#10

tSpl   spl    #0       ,}0
tClr   mov    tEnd     ,>tSelf
       djn.f  tClr     ,{tSelf
tEnd   dat    >1       ,2-tSelf
end qgo
