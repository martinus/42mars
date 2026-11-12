;redcode-94nop
;author inversed
;name     Evolved from LP paper (1)
;strategy Evolved from LP paper
;score 188.4
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

len0	equ	10
l	equ	19
k	equ	7973
a1	equ	14
b1	equ	1975
b2	equ	2691
ofs0	equ	7973
djs	equ	7974

from	add.x	#l,	>len0
	mul.f	#k,	to
loop	mov	<from,	{to
	mov	>a1,	{b1
	jmn.b	loop,	from
	spl	@from,	}b2
to	djn.f	ofs0,	{djs

