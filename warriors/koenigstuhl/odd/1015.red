;redcode
;name 1015
;author	Lukasz Adamowski
;assert 1

	nop	}1,	0
	mul	#1,	#1	; 1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	-1	; 0
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov	$-1,	$1
	mul	#1,	#1
	nop	{1,	>-1	; 1
	mov.b	$-1,	$1
	spl	$1
	mov.b	$-1,	$1
	spl	$1
	mov.ba	$-1,	$1
	spl	$0,	$0
	mov	>-1,	}-1
	mov	>1,	{-1
	jmp	$-1,	}1

