;redcode-94nop
;author inversed
;name     Evolved from 6-line Moore-style paper
;strategy Evolved from 6-line Moore-style paper
;score 212.1
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

zofs	equ	4616
a1	equ	1984
b1	equ	2645
a2	equ	3993
b2	equ	4008

	spl	2,	0
	spl	1,	0
	spl	1,	0

to	spl	zofs,	{from
	mov	}from,	}to
	mov	}a1,	{b1
from	mov	}bomb+1,}to
	jmz.b	to,	*from
bomb	dat	}a2,	>b2

