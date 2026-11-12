;redcode-NW
;name Anon Paper
;author inversed
;strategy paper
;assert 1

d	equ	(CORESIZE / 49)
step	equ	66 * d
b1	equ	43 * d
a2	equ	47 * d
b2	equ	44 * d
b3	equ	55 * d

silk	spl	#0	,	}step
	spl	@silk	,	>b1
copy	mov	}silk	,	>silk
	mov	{a2	,	<b2
	djn.f	 copy	,	<b3

