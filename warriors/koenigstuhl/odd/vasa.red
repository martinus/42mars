;redcode-94odd
;author Will 'Varfar'
;strategy id clear
;name Vasa
;assert 1

STEP	equ	13

gate	equ	(throw-5)

throw	mov	imp,	*MINDISTANCE
	add	#STEP,	throw
	djn	throw,	#((CORESIZE-MAXLENGTH)/STEP)

clear	spl	#1,	1
	mov	bmb,	>gate
	mov	bmb,	>gate
	djn.f	-1,	>gate
	
imp	mov.i	#imp,	1
	
bmb	dat	0,	2-gate 
