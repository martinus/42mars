;redcode
;name Y-Wing
;author Lukasz Adamowski
;strategy Y-Wing is bigger than X-Wing, but flies much faster
;strategy And no Tie Fighter can stop it!
;strategy It wipes all the DeathStar with the laser beam.
;assert 1

start	add	#-16,	target
target	jmz.f	$-1,	$-15
	mov.i	$laser,	@target
	jmn.f	$-1,	<target
	mov.i	$laser,	>target
	jmn.f	$-1,	@target
	jmp	start,	<target
laser	dat	$1,	$1

	end	start

