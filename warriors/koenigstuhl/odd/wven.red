;redcode-94odd
;name Wven
;author Will Varfar
;strategy DClear

;assert 1
;       (CORESIZE==256)
;       (MAXPROCESSES==4)
;       (MINDISTANCE==4)
;       (MAXLENGTH==4)

gate	equ	(start-10)

start	spl	#1,	1
	mov	bmb,	>gate
	djn.f	-1,	>gate
bmb	dat	0,	1-gate
	
	end
