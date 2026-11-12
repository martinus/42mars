;redcode
;name MadMan
;author Jakub Kozisek
;assert 1
; 2-9

	org	loop

bomb	dat	<-1,	{1
loop	add.f	inc,	ptr
	mov.i	bomb,	@ptr
ptr	nop	<last,	{bomb
	mod.ab	#10,	*ptr
inc	nop	<3,	<-5
	add.ab	#3,	last
last	jmp	loop,	<2
