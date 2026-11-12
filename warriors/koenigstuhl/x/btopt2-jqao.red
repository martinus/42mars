;redcode-94x
;name Blowtorch CX 64
;author Steve Gunnell
;strategy Dual incendary bombers
;assert CORESIZE==55440

STEP1  equ 28855
STEP2  equ 15152
GAP1   equ 13474
GAP2   equ 9007
START1 equ (hit1-GAP1-29960)
START2 equ (hit2-GAP2-2160)
SPACE1 equ 9
SPACE2 equ 12
SKIP   equ (ctop-cptr+12)

cptr   dat    #0    ,#100
       dat    SKIP  ,SKIP
clbmb  dat    SKIP  ,SKIP

for SPACE1
       dat.f  $0   ,$0
rof

mbmb1  mov.i  GAP1   ,}GAP1
sbmb1  spl    #1-GAP1,1-GAP1
throw1 mov.i  sbmb1  ,*START1
       mov.i  mbmb1  ,@throw1
       add.ab #STEP1 ,throw1
hit1   djn.f   -3    ,>cptr
       mov    clbmb  ,>cptr
       djn.f   -1    ,>cptr

for SPACE2
       dat.f  $0   ,$0
rof

mbmb2  mov.i  GAP2   ,}GAP2
sbmb2  spl    #1-GAP2,1-GAP2
throw2 mov.i  sbmb2  ,*START2
       mov.i  mbmb2  ,@throw2
       add.ab #STEP2 ,throw2
hit2   djn.f   -3    ,>cptr
       mov    clbmb  ,>cptr
ctop   djn.f   -1    ,>cptr

for (MAXLENGTH-CURLINE-2)
       dat.f  $0   ,$0
rof

start  spl    sbmb1
       jmp    sbmb2

end start

