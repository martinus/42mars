;redcode
;name spoiler
;author David Houston
;assert 1

org clear



ptr	djn	#0, #4000

	for	45
	dat	0, 0
	rof

clear	spl	#0, #200
	mov	-1, >ptr
	djn.f	-1, >ptr

	for	45
	dat	0, 0
	rof

refresh	djn	#0, #200
