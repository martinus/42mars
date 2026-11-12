;redcode-odd
;name Lclear
;author David Houston
;strategy Clear!
;assert 1

gate	equ	loop - 5

loop	spl	#0, >gate
	mov	*wipe, <wipe
	mov	*wipe, <wipe
	jmp	-2, >gate
	dat	-2, -10
	spl	#-2, -10
wipe	spl	#-1, -10

end
