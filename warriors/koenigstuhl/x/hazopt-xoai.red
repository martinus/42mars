;redcode-94x
;name  Giant Hazy A 100
;author Steve Gunnell
;strategy Blur2 variant with decoy.
;strategy Constants from Steveg's optimizer mill.
;strategy Added options.
;assert CORESIZE==55440

step   EQU 3294
gate   EQU top
away   EQU (clr+10889)
gap    EQU 9
G1     EQU 3
G2     EQU 108
IMPNUM EQU 37981

ptr:  mov.i  bomb, {step
top:  mov.i  bomb,>ptr          
	for 0
      mov.i  *top,>ptr          
	rof
scan: seq.i  2*step,2*step+gap
      mov.ab scan,@top
a:    sub.f  inc,scan
      jmn.b  top,@top
inc:  spl.i  #-step,>-step
      mov.i  clr,>gate
    for 0
      mov.i  clr,>gate
    rof
btm:  djn.f  -1,>gate
clr:  dat.f  <6761,clr-gate+2
      for G1
      dat 0,0
      rof
bomb: spl #1, #1
      for G2
      dat 0,0
      rof
boot: mov.i  clr,<dest
FOR 8+0+0
      mov.i  {boot,<dest
ROF
dest: mov.i  bomb,*away
      spl @dest,{-1000
      mov.i  {boot,<dest
      dat <dest,<dest
FOR 7
  spl.b  #1,1
spl.ab #1,1
spl.ba #1,1
spl.i  #1,1
spl.a  #1,*1
spl.b  #1,*1
spl.ab #1,*1
spl.ba #1,*1
spl.i  #1,*1
ROF

END boot
