;redcode-94nop
;author inversed
;name Disharmonious[v0.4]
;strategy Qscan -> sd-clear/imps (!)
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

istep	equ	2667
iinc	equ	2771
bd1	equ	3733
bd2	equ	2553
zclear	equ	32
djofs	equ	10

org	qgo

cptr	dat	s,	zclear

	for	1
	dat	0,	0
	rof

s	spl	#kill-cptr,	0
	spl	#0,	<cptr-djofs
	mov	*cptr,	>cptr
	mov	*cptr,	>cptr
	djn.f	-2,	<cptr-djofs
kill	dat	kill-cptr,	8

is	spl	#istep,	iinc
	add	is,	iptr
iptr	jmp	imp-istep-1,{iinc
imp	mov.i	#0,	istep

wgo	spl	1
	spl	1
	mov	}bp2,	>bp2
	mov	}bp1,	>bp1
	mov	}bp1,	>bp1
	spl	is+bd2,	0
	jmp	s+bd1,	0
bp1	dat	cptr,	cptr+bd1
bp2	dat	is,	is+bd2

	for 55
	dat	0,	0
	rof

	A	equ	6
	B	equ	3
	C	equ	9

	qf	equ	qkill
	qs	equ	qh*2
	qh	equ	106
	qi	equ	7
	qnum	equ	11

qgo	seq	qf+qs+qh,		qf+qs		;1
	jmp	qskip,			{qf+qs+qh+qi
	seq	qf+B*qs+qh,		qf+B*qs		;B
	jmp	qfast,			{qf+B*qs+qh+qi
	seq	qf+(B-1)*qs+qh,		qf+(B-1)*qs	;B-1
	jmp	qfast,			<qbomb
	seq	qf+(B+1)*qs+qh,		qf+(B+1)*qs	;B+1
	jmp	qfast,			>qbomb
	seq	qf+(A-1)*qs+qh,		qf+(A-1)*qs	;A-1
	djn	qfast,			{qfast
	seq	qf+A*qs+qh,		qf+A*qs		;A
	jmp	qfast,			{qfast

	sne	qf+B*C*qs+qh,		qf+B*C*qs	;BC
	jmz.f	wgo,			qf+B*C*qs+qh-10

qslow	mul	#C,		qkill
qfast	mul.b	qbomb,		@qslow
qskip	sne	{4096,		@qkill
	add	#qh,		qkill
qloop	mov	qbomb,		@qkill
qkill	mov	qbomb,		*qs
	sub	#qi,		qkill
	djn	qloop,		#qnum
	jmp	wgo,		{A       
qbomb	dat	{qi*qnum-10,	>B

