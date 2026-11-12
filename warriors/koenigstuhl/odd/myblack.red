;redcode
;name myBlack
;author Paulsson
;strategy Fast and dirty, is 92-96% good enough?????
;strategy two independent parts to fool the q-scan
;strategy used independently scores 85% wins
;assert 1
; KOFACOTO-1

org start

start	spl	astart
	jmp	bstart	

check	sne.i	comp,@next
	jmp	found
next	add.ab	#50,#4050
astart	jmz.f	next,@next
loop	jmn.f	loop,<next
	jmp	check,>next
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0

found	mov.i	>ptr2,>next
	djn.b	found,#6
	nop	0
	nop	0
	mov.i	comp,bnext
ptr2	jmp	<next,ptr3
comp	dat.f	<1,12
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
ptr3	dat	2,6
	dat	1,6
	spl	#1,6
	add.ab	#1141,ptr3
	mov.i	*ptr3,>ptr3
st	jmp	-2,>ptr3


bcheck	sne.i	bcomp,@bnext
	jmp	bfound
bnext	add.ab	#50,#150
bstart	jmz.f	bnext,@bnext
bloop	jmn.f	bloop,<bnext
	jmp	bcheck,>bnext
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0

bfound	mov.i	>bptr2,>bnext
	djn.b	bfound,#6
	nop	0
	nop	0
	mov.i	bcomp,next
bptr2	jmp	<bnext,bptr3
bcomp	dat.f	<1,12
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
	dat.f	0,0
bptr3	dat	2,6
	dat	1,6
	spl	#1,6
	add.ab	#1141,bptr3
	mov.i	*bptr3,>bptr3
bst	jmp	-2,>bptr3

