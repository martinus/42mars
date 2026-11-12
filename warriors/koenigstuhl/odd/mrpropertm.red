;redcode
;name Mr. Proper(TM)
;author Jakub Kozisek
;strategy dclear, nothing more to say
;assert 1
;       CORESIZE == 800

gate	equ	(start - 5)

	org	start

start   spl     #1,     <gate
loop	mov.i	bomb,	>gate
	mov.i	bomb,	>gate
	jmp	loop,	{gate
bomb	dat	<343,	3 - gate
