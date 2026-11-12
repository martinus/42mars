;redcode-94m
;name IMPossible!
;author Maurizio Vittuari
;strategy just a collage of good stuffs...
;assert 1

step	equ 	1143

step1   equ     2667
step2   equ     2668

space	equ	2390

paper   spl     1
	mov     -1,	0
	mov     -1,	0
s0      spl     @0,	space
	mov.i   }s0,	>s0
	mov.i   }s0,	>s0
s1      spl     @0,	step*2
	mov.i   }s1,	>s1
	spl     #0
	spl     1+step
imp	mov.i	#step,	*0

;----- gate busting spiral

start    SPL lnch1
	 SPL lnch3

lnch2    SPL 8
	 SPL 4
	 SPL 2
	 JMP imp2+(step2*0)
	 JMP imp2+(step2*1)
	 SPL 2
	 JMP imp2+(step2*2)
	 JMP imp2+(step2*3)
	 SPL 4
	 SPL 2
	 JMP imp2+(step2*4)
	 JMP imp2+(step2*5)
	 SPL 2
	 JMP imp2+(step2*6)
	 JMP imp2+(step2*7)

lnch3    SPL 8
	 SPL 4
	 SPL 2
	 JMP imp3+(step2*0)
	 JMP imp3+(step2*1)
	 SPL 2
	 JMP imp3+(step2*2)
	 JMP imp3+(step2*3)
	 SPL 4
	 SPL 2
	 JMP imp3+(step2*4)
	 JMP imp3+(step2*5)
	 SPL 2
	 JMP imp3+(step2*6)
	 JMP imp3+(step2*7)

lnch1    SPL 8
	 SPL 4
	 SPL 2
	 JMP imp1+(step1*0)
	 JMP imp1+(step1*1)
	 SPL 2
	 JMP imp1+(step1*2)
	 JMP imp1+(step1*3)
	 SPL 4
	 SPL 2
	 JMP imp1+(step1*4)
	 JMP imp1+(step1*5)
	 SPL 2
	 JMP imp1+(step1*6)
	 JMP imp1+(step1*7)
for 34
	dat	0,	0
rof

imp1     MOV.i #0,step1
	dat	0,	0
	dat	0,	0
	dat	0,	0
imp2     MOV.i #0,step2
	 MOV.i #0,step2
imp3     MOV.i #0,step2
	 MOV.i #0,step2

end	paper

