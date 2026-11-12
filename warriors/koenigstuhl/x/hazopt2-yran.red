;redcode-94x
;name  Hazy Star CX 1172
;author Steve Gunnell
;strategy Blur2 variant with decoy.
;strategy Constants from Steveg's optimizer mill.
;strategy Added options and different endgame.
;assert CORESIZE==55440

step   EQU 31556
away   EQU 51305
gap    EQU 14
G2     EQU 9

inc		dat  	-step,		-step
ptr:  mov.i  inc+1,}step
top:  	mov.i  	bomb,		>ptr          
	for 0
      	mov.i  	*top,		>ptr          
	rof
scan:	seq.i 	2*step,	2*step+gap
		mov.ab	scan,	@top
		sub.f 	inc,	scan
		jmn.b 	top,	@top
gate    jmp    	bomb,    	100

dbmb    dat    	bomb-gate,  9
bomb    spl    	#dbmb-gate, 11
clear   mov    	*gate,      >gate
        mov    	*gate,      >gate
tail    djn.f  	clear, 		{-250
      for G2
      	dat.f 	$0,		$0
      rof
boot: 	mov.i  	tail,		<dest
	FOR 7+4+0
      	mov.i  	{boot,		<dest
	ROF
dest: 	spl 	@dest,		away
      	mov.i  	{boot,		<dest
      	sub.f 	 dest,		 dest
      	dat.f 	$0,		$0
FOR 11
  spl.b  #1,1
spl.ab #1,1
spl.ba #1,1
spl.i  #1,1
spl.a  #1,*1
spl.b  #1,*1
spl.ab #1,*1
spl.ba #1,*1
spl.i  #1,*1
spl.a  #1,@1
spl.b  #1,@1
spl.ab #1,@1
spl.ba #1,@1
spl.i  #1,@1
ROF

END boot
