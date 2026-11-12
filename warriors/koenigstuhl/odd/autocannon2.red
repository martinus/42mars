;redcode
;name AutoCannon 2
;author Lukasz Adamowski
;strategy Clear It All!
;strategy Maybe in round 2 it will work? ;)
;strategy Thanks God I had a look more and I've found a mistake.
;strategy This is the right version. I hope it's not too late?
;assert 1
; KOFACOTO 2

start	spl	$1,	<(CORESIZE/4)
	spl	$1,	<(CORESIZE/2)
	spl	$1,	<(CORESIZE*3/4)
	mov	$bomb,	<bomb
	mov	$bomb,	<bomb
	mov	$bomb,	<bomb
	djn	$-3,	#(7992/3)
	mov	$0,	$1
bomb	dat	#0,	#7992
	end	start


