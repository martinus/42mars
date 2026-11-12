;redcode
;name SaboVampire
;author Lukasz Adamowski
;assert 1

start
vamp	spl	#-85,	#85
	add	$-1,	$teeth
	mov	$teeth,	@teeth
	jmp	$-2,	$vamp
	dat	$1,	$1
	dat	$1,	$1
	dat	$1,	$1
	dat	$1,	$1
teeth	jmp	$pit-10,	$10
pit	spl	$1,	{vamp-5
	mov	$vamp-5,	{vamp-1
	mov	$vamp-5,	{vamp-1
	jmp	$-3,	{vamp-5

	end	start

