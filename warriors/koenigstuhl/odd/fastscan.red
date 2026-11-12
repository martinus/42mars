;redcode-tiny
;name Fast Scan
;author Lukasz Adamowski
;assert 1
;       CORESIZE==800

start
	sne.f	$decode+358*531,	@decode
	sne.f	$decode+356*531,	{decode
	sne.f	$decode+357*532,	}decode
	sne.f	$decode+357*530,	<decode
	sne.f	$decode+521,	>decode
decode	mul.ab	#357,	#531
	spl	#0,	#0
	mov	$-1,	<decode

	end	start

