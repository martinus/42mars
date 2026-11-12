;redcode
;name airbagged bomber
;author roy van rijn
;assert 1

pStep	equ	927

	spl     1
	mov.i   -1		, #0
	mov.i   -1		, #0

	spl	pStep		, 0
	mov.i	>-1		, }-1
	mov.i	>-2		, }-2
	mov.i	>-3		, }-3
	djn.b	}pEnd		, #5

sStart	mov.i	{pBmb		, *pPtr
	add.f	}pBmb		, pPtr
	mov.i	{pBmb		, @pPtr
	jmn.a	-3		, }pBmb

pPtr	spl	#2100		, >348
	mov.i	pBmb		, >sStart-1
pEnd	djn.f	-6		, >sStart-1

	dat	<2355		, }983
pBmb	dat	}0		, <10

	dat	<2667		, <5334 ; luggage...

