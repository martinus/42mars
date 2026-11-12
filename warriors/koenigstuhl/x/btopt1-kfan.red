;redcode-94x
;name Blowtorch BX 135
;author Steve Gunnell
;strategy Simple .5C bomber
;assert 1

STEP   equ 22167
GAP    equ 43523
START  equ (hit-GAP-5400)
GAP1   equ 15
SKIP   equ (ctop-cptr+15)

cptr   dat    #0    ,#25438
       dat    SKIP  ,SKIP
clbmb  dat    SKIP  ,SKIP

for GAP1
       dat.f  $0   ,$0
rof

mbmb   mov.i  GAP   ,>GAP
sbmb   spl    -1    ,1-GAP
start  spl    #0    ,0
throw  mov.i  sbmb  ,* START
       mov.i  mbmb  ,@throw
       add.ab #STEP ,throw
hit    djn.f   -3   ,>cptr
       mov    clbmb ,>cptr
ctop   djn.f   -1   ,>cptr

end start

