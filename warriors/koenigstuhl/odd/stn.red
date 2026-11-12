;redcode-94nop
;assert 1
;name stn
;author Lukasz Grabun

s	equ 445

	mov b	, @1
	mov b	, @b
a	add #2*s, -1
	jmp -3  , 0
b	dat 0	, 3995

	end	a
