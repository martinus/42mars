;redcode-94
;name tmp
;author Joonas
;assert 1

	djn.f	1,@1
	nop	{1,{1
	mul.ab	#-1,#-1
	spl	1,-1
	mov.b	@-1,@1
	spl	1,1
	spl	@0,	0
	mov	}-1,	>-1
	jmp	@-1
	end