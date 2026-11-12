;redcode-odd
;name DClear
;author Will 'Varfar'
;strategy Old faithful
;assert 1

gate	dat	0,	MINDISTANCE	; this isn't a contest about

	
	for	7
	dat	0,	0
	rof

clear	spl	#1,	1
	mov	bmb,	>gate
	mov	bmb,	>gate
	djn.f	-1,	>gate

bmb	dat	0,	2-gate

	end	clear

