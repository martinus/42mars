;redcode-94nop
;author inversed
;name     Evolved from Kline-style paper
;strategy Evolved from Kline-style paper
;score 187.4
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

ofs	equ	534
a1	equ	2682
a2	equ	2644
b1	equ	3996
b2	equ	2682
pba	equ	1982
pbb	equ	5334

	spl	1,	0
	spl	1,	0
	spl	1,	0

ptr	mov	pbomb,	>pbomb+1
	mov	<ptr,	<silk
silk	spl	@0,	>ofs
	mov	}a1,	<silk
	mov	>a2,	{b1
	add	pbomb,	>b2
	jmn.f	@0,	>ptr
pbomb	dat	}pba,	<pbb

