;redcode-94nop
;author inversed
;name     Evolved from Timescape-style paper
;strategy Evolved from Timescape-style paper
;score 146.7
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

ofs1	equ	7486
ofs2	equ	7991
a1	equ	2022
b1	equ	28

	spl	1,	0
	spl	1,	0
	spl	1,	0

silk1	spl	@0,	}ofs1
	mov	}silk1,	>silk1
	add.f	#a1,	{b1
	mov	{silk1,	<silk2
silk2	djn.b	@0,	>ofs2

