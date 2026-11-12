;redcode-94odd
;name Hano
;author Will Varfar
;strategy none

;assert 1
;       (CORESIZE==256)
;       (MAXPROCESSES==4)
;       (MINDISTANCE==4)
;       (MAXLENGTH==4)

gate	equ	(top-10)

top	mov	#-gate+MINDISTANCE,gate
	spl	#1,	1
train	djn.f	train,	>gate

	end
