;redcode
;name Sneaky 88
;author Christian Schmidt
;strategy self-replicating stone/scanner
;assert CORESIZE == 8000
;kill Sneaky 88

sLen   equ  17
sStep  equ  5601
sStrt1 equ  4039
sStrt2 equ  2270
pStep  equ  1438
pAdd   equ  2411
bDist  equ  3098

paper mov #sLen,   sLen
start add step,    sptr
sptr  mov <sStrt1, sStrt2
scan  jmz start,   <sptr
copy  mov <paper,  <sptr
      jmn copy,    paper
jump  spl @sptr,   <pStep
reset jmz paper,   paper
step  dat <sStep,  #sStep-1

dat #0, #0


bstart mov step,  nil+bDist+9
for 8
       mov <boot, <bstart
rof
boot   jmp nil+bDist+3, step

for 43
dat #0, #0
rof

;.............. QScan .....................................;

qs      equ     3841
qd      equ     4000
qbinc   equ     (-9)
qbhop   equ     43
qbtime  equ     6
nil     equ     start+100

qscan   cmp     2*qs+qd         ,         2*qs
qt1     jmp     qa0             ,       < 3*qs
        cmp     qscan+ 5*qs+qd  ,         qscan+ 5*qs
qt2     jmp     qa1             ,       < 4*qs
        cmp     qscan+ 4*qs+qd  ,         qscan+ 4*qs
qs1     djn     qa1             ,       # qt1
        cmp     qscan+10*qs-2   ,         qscan+10*qs+qd-2
qs2     djn     qa2             ,       # qt2
        cmp     qscan+ 9*qs+qd  ,         qscan+ 9*qs
qt3     jmp     qa2             ,       < 6*qs
        cmp     qscan+ 6*qs+qd  ,         qscan+ 6*qs
        jmp     qa2             ,       < qa1
        cmp     qscan+ 8*qs+qd  ,         qscan+ 8*qs
        jmp     qa2             ,       < qs1
        cmp     qscan+11*qs     ,         qscan+11*qs+qd
        jmp     qa3             ,       < qa2
        cmp     qscan+18*qs-8   ,         qscan+18*qs+qd-8
qs3     djn     qa3             ,       # qt3
        cmp     qscan+16*qs-2   ,         qscan+16*qs+qd-2
        jmp     qa3             ,       < qs2
        cmp     qscan+12*qs     ,         qscan+12*qs+qd
        jmp     qa3             ,       < qa1
        cmp     qscan+14*qs     ,         qscan+14*qs+qd
        jmp     qa3             ,       < qs1
        jmz     bstart          ,         qscan+15*qs

qa3     add     @ qs3           ,         qp
qa2     add     @ qs2           ,       @ qa3
qa1     add     @ qs1           ,       @ qa3
qa0     cmp     @ qp            ,         nil
        cmp     @ 0             ,         0
        add     # qd            ,         qp
ql      mov       qbomb         ,       @ qp
qp      mov       nil           ,       < qscan+2*qs
        add     # qbinc         ,       @ ql
        djn       ql            ,       # qbtime
        jmp       bstart        ,         0
qbomb   dat     # 0             ,       # qbhop

end     qscan

