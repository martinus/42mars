;redcode
;name Fast Hack'em
;author Sascha Zapf
;Entry for the 4th IRC-Mini-Tournament on Sunday 2003-03-30
;strategy paper without { } < >
;assert 1

away	EQU	312

start	spl 	1
	spl 	1
	spl 	1
	spl	adder

nsilk	mov.i	nsilk,	away
	mov.i	imp,	-30
	jmp	nsilk+away
imp	mov.i	0,1
adder	add.f	inkr,	nsilk
	mov.i	inkr, -20
	jmp	adder+away
inkr	dat	1,1

	end start
