;redcode-94nop
;name ScAnNiNg MaNiAc
;author Jakub Kozisek
;strategy JMZ scanner -> core clear
;assert 1

	org	loop

STEP	equ	8

; ============= SCAN ==============

loop	add.ab	#STEP,	ptr
	jmz.f	loop,	@ptr
ptr	mov.i	split,	0
	jmn.f	@0,	loop
split	spl	#0,	{0
	mov.i	bomb,	*split
	jmp	@-1,	<-10
bomb	dat	<267,	<534
