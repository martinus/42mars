;redcode
;name AutoCannon 1
;author Lukasz Adamowski
;strategy Clear It All!
;strategy There was a little mistake in code, here is the right version.
;assert 1
; KOFACOTO-1

bomb	dat	$0,	$12
	dat	$0,	$0
	dat	$0,	$0
start	spl	$1,	<(CORESIZE/4)
	spl	$1,	<(CORESIZE/2)
	spl	$1,	<(CORESIZE*3/4)
	mov	$bomb,	>bomb
	mov	$bomb,	>bomb
	mov	$bomb,	>bomb
	jmn	$-3,	$bomb
	mov	$0,	$1
	end	start


