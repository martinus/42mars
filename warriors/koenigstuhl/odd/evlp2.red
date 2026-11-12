;redcode-94nop
;author inversed
;name     Evolved from LP paper (2)
;strategy Evolved from LP paper
;score 235.6
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

len	equ	19
len0	equ	9
b1	equ	2026
a2	equ	1991
b2	equ	1985
dec	equ	3975
zofs	equ	3256

from	add	#len,	len0
loop	mov	<bmb,	<b1
bmb	add.f	#a2,	<b2
	mov	<from,	<to
	jmn	loop,	from
	spl	@from,	<dec
to	jmz	@0,	zofs

