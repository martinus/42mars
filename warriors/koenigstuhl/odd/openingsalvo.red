;redcode-94
;name Opening Salvo
;author Chip Wendell
;strategy RF13 entry: scan -> stone
;strategy Go for two points (force opponent to modify counter)
;assert 1

step	equ	125
scan	add	#step,	dcnt	;slow scan
ptr	jmz.b	scan,	@dcnt
	mov	@dcnt,	test 	;found something; test it
	mov.f	@dcnt,	trap
	add.x	test,	test
	sne	dat00,	test	;check to see if upper
	jmp	upper
	sne	dat11,	test	;check to see if lower
	jmp	lower
	add	#5,	dcnt	;check to see if counter
	mov	@dcnt,	test
	add.x	test,	test
	sne	dat11,	test
	jmp	lower
	sub	#5,	dcnt	;none of the above - must be enemy code
	mov.a	#pen-dcnt, trap
	sub.ba	dcnt,	trap
	mov	trap,	@dcnt
bptr	jmp	scan,	#strap-bptr	;keep looking

;stone code
sstep	equ	85
scnt	equ	1599
sinc	nop	sstep,	-sstep	;executable data storage
stone	mov	strap, *strap
	add	sinc,	strap
	djn	stone,	#scnt
	spl	#0,	<strap	;rev up to withstand final counter barrage
	jmp	#0,	{strap+5	;try to trip up any jmn 0, -2
latecomers
strap	mov	#sstep-5,	9-sstep

;upper counter stream decoy 
ndecoy equ	76
i for ndecoy
	dat.f	-(ndecoy-i+3), (ndecoy-i+3)
rof

;counter decoy
	mov dat11 , >dat11
	mov dat11 , {dat11
dcnt	djn -2  , #step
dat11	dat -1, -1
pen	jmp	0

;lower counter stream decoy 
i for ndecoy
	dat.f	-2-i, i+1
rof

dat00	dat	0,	0
trap	jmp	0

upper	mov.x	trap,	trap	;calculate counter location
lower	add.ba	dcnt,	trap
	add.a	#dcnt-trap+1, trap
	mov	*trap,	test	;test for decoy counter
	nop	{test,	>test
	nop	0		;do something useful while I'm waiting? Nah.
	seq	*trap,	test
	jmp	scan

	add.a	#trap-pen-1, trap	;bomb holding pen before I go
	mov	trap, pen

	sub.a	#trap-pen+2, trap	;boot stone
bloop	mov	@bptr,	{trap
	djn	bloop,	bptr
	jmp	*trap

test	dat	0,	0
	end	scan
