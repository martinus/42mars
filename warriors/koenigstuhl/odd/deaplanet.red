;redcode
;name Dead Planet Society
;author Lukasz Adamowski
;assert 1

MAX	EQU	24900

step	nop	$200,	$201
point1	nop	$0,	$0	
point2	nop	$0,	$0	
loop	add	step,	check
check	sne	10000,	10100
	jmz	loop,	<-1
	mov.f	check,	point1
	mov.f	point1,	point2
	div.ab	#MAX,	point1
	mod.ab	#MAX,	point2
	mov.b	point1,	shoot+1
	mov.b	point2,	trgt
	add.ab	#100,	trgt
	spl	loop,	>shoot+1

bomb	EQU	trgt

shoot	mov.ab	#10,	#0
	djn	copy,	#1
clear	mov	bomb,	<trgt
	mov	bomb,	<trgt
	mov	bomb,	<trgt
	djn	clear,	#100
trgt	dat	$0,	$MAX
copy	mov.i	<shoot,	<MAX+3
	jmn.b	$-1,	shoot
	jmp	@MAX+1

	end	check
