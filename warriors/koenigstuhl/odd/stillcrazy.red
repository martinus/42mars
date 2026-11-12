;redcode
;name Still Crazy
;author Jakub Kozisek
;assert 1
; 13-19

	org	first

first	spl	#0,	{ptr
ptr	nop	<-2,	>last+4
	div.a	#0,	>ptr
	nop	>ptr,	>ptr
jump	djn.f	first,	{ptr
	mov.i	2,	@jump
last	jmp	first,	{1
