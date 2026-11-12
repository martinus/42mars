;redcode-odd
;name Oneshot
;author Will 'Varfar'
;strategy Completely untested and a massive target
;assert 1

gate	dat	0,	MINDISTANCE
	
	for	6
	dat	0,	0
	rof
	
inte	equ	7	
step	dat	inte,	inte
scan	add	step,	ptr
ptr	sne	gate+MINDISTANCE,gate+MINDISTANCE+(inte*2)
	jmp	scan
;break
	slt	#0,	ptr
	jmp	clear
	mov.ab	ptr,	gate
	

clear	spl	#1,	1
	mov	bmb,	>gate
	mov	bmb,	>gate
	djn.f	-1,	>gate

bmb	dat	0,	2-gate

	end	scan
