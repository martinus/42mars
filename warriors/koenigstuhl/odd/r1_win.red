;redcode-rf23
;name R1_Win
;author Roy van Rijn
;assert 1
;strategy 2x BombPaper + Imp + Gate

step1    equ    24240
bstep1a  equ    1457
bstep1b  equ    6236
bstep1   equ    2551
bamount1 equ    134

	mov.ab	#11,#11
   	mov.ab	#step1,#step1
	sub.x 7,1
	mov.i }bstep1a,     bstep1b
	djn.b -2,#bamount1
	mov.ab #bamount1,-1
	mov.f 4,-3
c1      mov <-7,<-6
        jmn.b -1,-8
        jmp @-8,bstep1
	dat bstep1a,bstep1b

for 100
dat 0,0
rof

step2    equ    12452
bstep2a  equ    4532
bstep2b  equ    6335
bstep2   equ    5135
bamount2 equ    2533

	mov.ab	#11,#11
   	mov.ab	#step2,#step2
	sub.x 7,1
	mov.i }bstep2a,     bstep2b
	djn.b -2,#bamount2
	mov.ab #bamount2,-1
	mov.f 4,-3
c2      mov <-7,<-6
        jmn.b -1,-8
        jmp @-8,bstep2
	dat bstep2a,bstep2b

for 100
dat 0,0
rof

gate	djn.f	#0,<-10
	jmp	#0,<-11

for 100
dat 0,0
rof

imp	mov.i	#1,1

die     stp     #13,#13
        dat     0,0

boot    ldp	#12,#0
	nop	>-1
	stp	-2,#12

res     ldp     #0,#0   ;die the first round
        seq.b   -1,#-1
        jmp     2
        dat     0,0

warrior spl     c1
        spl     c2
spl	imp
jmp gate
end boot
