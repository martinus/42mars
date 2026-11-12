;redcode-tl
;name Tiny Rottinger
;author G.Labarga
;assert 1
;strategy Qscan->paper/stone
;strategy re-re-optimized

Qstep equ 282
Where1 equ (3*Qstep)
Where2 equ (7*Qstep)

pdist equ 402
pinit equ 717
bstep1 equ (557*2)
bstep2 equ (479*2)
decrem equ 3616

src:	mov.ab #9,#9
v1:	add.a #pdist,dst
loop:	mov.i <src,{dst
	mov.i {bstep1,{bstep2 
	add.f {0,}0
	jmn.b loop,src
	spl @src,>decrem
dst:	jmz.b pinit,*0
	dat }1,>1
for	13
	dat 0,0
rof
Qscan:
qs1x:	sne.i Qchk+(3*Qstep),Qchk+(7*Qstep)
	seq.i Qchk+(10*Qstep),Qchk+(4*Qstep)
	jmp Qchk
qs2x:	sne.i Qchk+(6*Qstep),Qchk+(14*Qstep)
	seq.i Qchk+(13*Qstep),Qchk+(11*Qstep)
	jmp Qdec,<Qfact
qs3x:	sne.i Qchk+(9*Qstep),Qchk+(21*Qstep)
	seq.i Qchk+(16*Qstep),Qchk+(18*Qstep)
	jmp Qdec,}Qfact
qs4x:	sne.i Qchk+(12*Qstep),Qchk+(28*Qstep)
	seq.i Qchk+(19*Qstep),Qchk+(25*Qstep)
	djn.f @0,{Qdec
qs5x:	sne.i Qchk+(15*Qstep),Qchk+(35*Qstep)
	seq.i Qchk+(22*Qstep),Qchk+(32*Qstep)
	djn.a Qdec,*0
	jmp loop,>-212
	dat 5,5
Qfact:	dat 2,3
Qbmb:	dat >(7*Qstep),>-(3*Qstep)
Qdec:	mul.f Qfact,Qchk
Qchk:	sne.i Where1,Where2
	add.f Qbmb,Qchk
Qatk:	mov.i Qbmb,*Qchk
	mov.i Qbmb,@Qchk
	sub.f #-7,@-7
	djn.b Qatk,#7
	jmp loop,>-238

end Qscan

