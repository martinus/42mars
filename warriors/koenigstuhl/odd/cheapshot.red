;redcode
;name Cheapshot
;author David Houston
;assert 1
;       CORESIZE == 800

org	loop + 1

ptr	dat	-367, -55

loop	sub.f	inc, ptr
	sne	*ptr, @ptr
	sub.f	inc, ptr
	sne	*ptr, @ptr
	jmp	loop
inc	spl	#15, 15
	mov	-1, }ptr
	mov	-2, >ptr
	jmp	-2

end
