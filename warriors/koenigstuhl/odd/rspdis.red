;redcode-94nop
;name RSP-Dis
;author Philip Thorne (LG)
;strategy Disincentive's Paper [Lukasz Grabun]
;strategy [stripped QS, reversed constants]
;assert CORESIZE==8000
;irct23

	org	pGo

pHit0	equ	-1369
pHit1	equ	-543
pDst0	equ	-4187
pDst1	equ	-3065
pDst2	equ	-1282

pGo     spl 	2		, 0
	spl	2		, 0
	spl	1		, }0
	spl	1		, 0

pSilk0  spl     @0		, <pDst0
   	mov     }pSilk0		, >pSilk0
pSilk1  spl     @0		, <pDst1
        mov     }pSilk1		, >pSilk1
	mov     pBmb		, >pHit0
	mov	pBmb		, >pHit1
        mov     {pSilk1		, <pSilk2
pSilk2  djn.f   @0		, <pDst2
pBmb	dat     >2667		, >5334

end
