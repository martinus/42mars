;redcode-94x
;name Bicarb BX 28
;author Steve Gunnell
;assert 1

BMB    equ (cbase - 7167)
GATE   equ (ctop1 - 88)
START1 equ 11999
START2 equ 5437
WAIT   equ 101
GAP1   equ 11
GAP2   equ 13
GAP3   equ 11
STEP1  equ 29341
STEP2  equ 21395

CPTR   dat    #0    ,#100

for GAP1
       dat.f  $0   ,$0
rof

cclr   djn.b  #0    ,#WAIT
       spl    paper
       spl    #0    ,0
       mov    clbmb ,>CPTR
       djn.f   -1   ,>CPTR
clbmb  dat    >2667 ,#ctop1-CPTR

for GAP2
       dat.f  $0   ,$0
rof

ctop1  spl    #0    ,#0
       spl    cmov2 ,<GATE
cmov1  mov.i  BMB   ,>1
       mov.i  BMB   ,<START1
cadd1  add.ab {0    ,}0
       djn.f  cmov1 ,<GATE

for 16
       dat.f  $0   ,$0
rof

cmov2  mov.i  BMB   ,>1
cbase  mov.i  BMB   ,<START2
cadd2  add.ab {0    ,}0
       djn.f  cmov2 ,<GATE

       dat.f  $0   ,$0
for GAP3
       dat.f  $0   ,$0
rof

paper  spl    1,         <paper
       spl    1,         <paper
tpap   spl    @0        ,STEP1
       mov    }-1,       >-1
       mov.i  {tpap      ,<xpap
xpap   jmz.a  @0        ,STEP2

for MAXLENGTH-CURLINE-4
       dat.f  $0   ,$0
rof

start  mov.i  bomb  ,*cbase
       spl    cclr
       jmp    ctop1
bomb   dat    >-1   ,<GATE+cbase

end start

