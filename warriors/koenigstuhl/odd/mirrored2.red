;redcode
;name Mirrored Two
;author Lukasz Adamowski
;strategy  A toy once written :]
;strategy  This one is more funny than Mirrored One :]]]
;assert 1

start	mov	>5,	<115
	jmn	$-1,	$4
	jmp	@113,	$0
	jmn	$-1,	$4
	mov	>5,	<115
	dat	$0,	$-5

	end	start

