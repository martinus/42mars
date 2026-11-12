;redcode-94x
;name  Giant Hazy B 75
;author Steve Gunnell
;strategy Blur2 variant with decoy.
;strategy Constants from Steveg's optimizer mill.
;strategy Added options.
;assert CORESIZE==55440

step   EQU 17946
gate   EQU top
away   EQU (clr+25639)
gap    EQU 6
G1     EQU 2
G2     EQU 121
IMPNUM EQU 34117
HOP    EQU clr-gate+2

ptr:  mov.i  inc+1,<step
top:  mov.i  bomb,>ptr          
	for 1
      mov.i  *top,>ptr          
	rof
scan:	sne.x 	2*step,	2*step+gap
		sub.f 	inc,	scan
		seq.x 	*scan,	@scan
		mov.ab	scan,	@top
		sub.f 	inc,	scan
		jmn.b 	top,	@top
inc:  spl.i  #-step,>-step
      mov.i  clr,>gate
    for 0
      mov.i  clr,>gate
    rof
btm:  djn.f  inc+1,>gate
clr:  dat 0, HOP
      for G1
      dat 0,0
      rof
bomb: spl #1, #1
      for G2
      dat 0,0
      rof
boot: mov.i  clr,<dest
FOR 4+6+0+1
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
ROF

END boot
