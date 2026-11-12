;redcode
;name Sabotage
;author Lukasz Adamowski
;assert 1

	PIN	13

start	nop	$0,	$0
	ldp.a	#-5,	$1
	jmp	@0,	$dwarf
	dat	$1,	$1
	dat	$1,	$1
	dat	$1,	$1
dwarf	add	#85,	$1
	mov	$2,	$-1
	jmp	$-2,	$0
	mov	$0,	$1

	end	start
