;redcode
;name X-Wing
;author Lukasz Adamowski
;strategy Small-Single-Threaded-Sorta-Single-Instruction-Scanner
;strategy Ask yourself: Why it's enough one small X-Wing fighter to
; destroy massive DeathStar?
;strategy Ask yourself: Maybe it's because X-Wings do fly with the
; speed of light?
;assert 1

start	jmz.f	#0,	{4
	mov.i	$2,	*3
	jmp	$-2,	$0
	dat	$-5,	$1
	dat	$-5,	$1

	end	start

