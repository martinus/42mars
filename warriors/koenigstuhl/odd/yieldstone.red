;redcode
;name YieldStone
;author Joonas Pihlaja
;assert 1
;strategy for redcoder's frenzy round 10

STEP	equ	(4)
	PIN	31

	ldp	#32,	4
	add	#STEP,	1
	mov	2,	2-80*STEP
	jmz	-2,	1
	mov.i	#1,	*0
end
