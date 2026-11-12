;redcode-94nop
;author inversed
;name Biomass_v0.6
;strategy A bit unusual paper optimized against oneshots
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

ofs0	equ	3420
ofs1	equ	1342
ofs2	equ	511
a1	equ	3856
a2	equ	-92
a3	equ	-1987
b3	equ	2477
djs	equ	-359

start	spl	1
	spl	1
	spl	1

silk0	spl	@0,    <ofs0
	mov	}silk0,>silk0
	mov	}silk0,>silk0
silk1	spl	@0,    <ofs1
	mov	}silk1,>silk1
	mov	{silk1,<silk2
silk2	spl	@0,	 >ofs2
	mov.i	#a1,	 {1
	mov.i	#a2,	 <1
	mov.i	#a3,	 }b3
	djn.f	{b3-9,   <djs

