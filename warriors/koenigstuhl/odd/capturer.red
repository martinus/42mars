;redcode
;name The Capturer
;author Lukasz Adamowski
;assert 1

start	mov	bjmp,	{bjmp
	djn.a	$-1,	$bjmp
	jmz.b	$0,	{bdat
	mov	$bdat,	*bdat
	jmn.b	$-2,	$chck
	mov	$0,	$1
	dat	$0,	$0
	dat	$0,	$0
chck	dat	$0,	$1
bjmp	jmp	#-10,	$0
	dat	$0,	$0
bdat	dat	$-11,	$0

	end	start
