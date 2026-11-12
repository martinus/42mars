;redcode
;name
;author Lukasz Adamowski
;assert 1

boot	spl	1
	spl	1
	spl	1
	jmp	3,	3
	dat	0,	8
	dat	0,	8
	mov	}-2,	>-2
	mov	}-2,	>-2
	jmp	6
	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0

	end	boot