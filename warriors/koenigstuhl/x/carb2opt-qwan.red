;redcode-94x
;name Bicarb AX 27
;author Steve Gunnell
;assert 1

GATE 	equ 	(ctop1 - 57)
BMB  	equ 	(cmov1 + 10124)
CNT  	equ 	40447
GAP1 	equ 	127
GAP2 	equ 	43
DPTR 	equ 	11
SKIP 	equ 	19
DGAP 	equ 	24777
IMP 	equ 	35873

ctop1  spl    #0    ,<GATE
cmov1  mov.i  BMB   ,cadd1-(BMB*CNT)
cadd1  add.ab {0    ,}0
       djn.f  cmov1 ,<GATE

for GAP1
       dat.f  $0    ,$0
rof

ctop2  spl    #0    ,<GATE
cmov2  mov.i  BMB   ,cadd2-(BMB*CNT)
cadd2  add.ab {0    ,}0
       djn.f  cmov2 ,<GATE

for GAP2
       dat.f  $0   ,$0
rof

dtop   spl    #0    ,#0
       mov.i  dbmb  ,>dtop-DPTR
       djn.f  -1    ,>dtop-DPTR
dbmb   dat    >IMP	,SKIP

dboot  spl    DGAP
       mov.i  dtop  ,}dboot
       mov.i  dtop+1,}dboot
       mov.i  dtop+2,}dboot
       mov.i  dtop+3,}dboot
       sub.f  dboot ,dboot
       dat.f  $0   ,$0

start  mov.i  bomb  ,*cmov1
       spl    1
       mov.i  -1    ,0
       jmp.a  @1   ,}0
       dat    0     ,ctop1
       dat    0     ,ctop2
       dat    0     ,dboot
bomb   dat    >-1   ,>1

end start

