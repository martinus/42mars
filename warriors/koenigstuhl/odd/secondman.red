;redcode
;name SecondMan
;author Lukasz Adamowski
;assert 1

start	spl	1
	spl	1
	spl	1
	mov	<8,	<1
	spl	@0,	$2222
	mov	<8,	<1
	spl	@0,	$531
	mov	$4,	<-1
	djn	$-1,	$-2
	mov.i	#0,	1

	end	start

