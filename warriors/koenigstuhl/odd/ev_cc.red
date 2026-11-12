;redcode-94nop
;author inversed
;name     Evolved from CC-style paper
;strategy Evolved from CC-style paper
;score 158.9
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

ofs0	equ	3979
ofs1	equ	28
ofs2	equ	6460
a1	equ	2652
a2	equ	4018
b1	equ	7531
b2	equ	2023
djs	equ	1918

	spl	1,	0
	spl	1,	0
	mov	-1,	0

silk0	spl	@0,	}ofs0
	mov	}silk0,	>silk0
	mov	}silk0,	>silk0
silk1	spl	@0,	<ofs1
	mov	}silk1,	>silk1
silk2	spl	@0,	}ofs2
	mov	}silk2,	>silk2
	mov	>a1,	{b1
loop	add.a	#a2,	{b2
	djn.f	loop,	{djs

