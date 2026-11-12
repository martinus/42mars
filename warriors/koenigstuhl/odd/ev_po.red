;redcode-94nop
;author inversed
;name     Evolved from Paperone-style paper
;strategy Evolved from Paperone-style paper
;score 201.1
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

ofs0	equ	30
b1	equ	1995
a2	equ	1999
b2	equ	5596
a3	equ	13
b3	equ	2679
a4	equ	2696
b4	equ	1988

	spl	1,	0
	spl	1,	0
	spl	1,	0

silk	spl	@0,	}ofs0
	mov	}-1,	>-1
	mov	pbomb,	{b1
	mov	<a2,	{b2
	add.b	{silk,	*0
	jmz.a	@0,	silk
	sub.ba	#a3,	{b3
pbomb	add.x	#a4,	{b4

