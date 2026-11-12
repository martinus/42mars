;redcode-94
;name Blowtorch Test B 84
;author Steve Gunnell
;assert 1

STEP   equ 4076
GAP    equ 1317
START  equ (hit-GAP-STEP*6629)
GAP1   equ 14
SKIP   equ (ctop-cptr+12)

cptr   dat    #0    ,#100
       dat    SKIP  ,SKIP
clbmb  dat    SKIP  ,SKIP

for GAP1
       dat.f  $0   ,$0
rof
mbmb   mov.i  GAP   ,}GAP
sbmb   spl    #1-GAP,1-GAP
throw  mov.i  sbmb  ,*START
       mov.i  mbmb  ,@throw
       add.ab #STEP ,throw
hit    djn.f   -3   ,>cptr
       mov    clbmb ,>cptr
ctop   djn.f   -1   ,>cptr

end sbmb
