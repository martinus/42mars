;redcode-94nop
;name Heist
;author lain
;strategy Qscam -> paper
;strategy further optimized Qscam & paper
;assert 1

BOOTN equ -250

qtaboff equ 55
qtabhop equ 98

first q1first
i for 35
dat MAXLENGTH+MAXLENGTH+(2*i-1)*qtabhop-CURLINE+qtaboff,MAXLENGTH+MAXLENGTH+(2*i-1)*qtabhop-CURLINE+qtabhop+qtaboff
rof

;rearranged table seems to be slightly better

i for 37
dat MAXLENGTH+MAXLENGTH+(2*i-1)*qtabhop-CURLINE,MAXLENGTH+MAXLENGTH+(2*i-1)*qtabhop-CURLINE+qtabhop
rof
q2last

dat $0,$0

wfirst

;--------------[QSCAM]
qscan sne.i *q2last-BOOTN-11,@q2last-BOOTN-11
djn.f -1,-1
add.f *qscan,qscan

qbomb equ qscan-1

qloop mov.i qbomb,*qscan
mov.i *-1,@qscan
add.f #-7,qscan
djn qloop,#18

;---------------[PAPER]

pStepB equ 1852 ;4333
nstep1 equ 4394 ;1726
stream equ 1462 ;2544

pfirst spl 2,>1000
spl 1,>2000
spl 1,>3000
silkB spl @0,<pStepB
mov.i }silkB,>silkB
nothB spl @nothB,<nstep1
mov.i }nothB,>nothB
bomb mov.i #1,<1
wlast cc djn.b -2,#stream

;--------------[BOOT]

bptr mov.i wlast,{ptr
SPLIT spl 2,>q1first-1 ;this one increment gives us ~7 points, very
important to cancel the qscam

i for 8
mov.i {bptr,{ptr
rof

ptr  jmp BOOTN,{0 ;neat little trick to kill one process

end bptr

