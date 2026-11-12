;redcode-94nop
;author inversed
;name     Evolved from 8-line Moore-style paper
;strategy Evolved from 8-line Moore-style paper
;score 223.8
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

ofs1	equ	3581
a1	equ	2664
b1	equ	6494
a2	equ	1976
b2	equ	2027
a3	equ	2656
b3	equ	3978

	spl	1,	0
	spl	1,	0
	spl	1,	0

to	spl	ofs1,	{from
	mov	}from,	}to
	mov	}a1,	{b1
	add.ba #a2,	{b2
from	mov	@to+8,	}to
	mov	>a3,	{b3
	jmz	to,	*from

