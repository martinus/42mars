;redcode
;name 2
;author Lukasz Adamowski
;strategy Two-pass clear (well, almost... ;)
;assert MAXLENGTH>4*6

	FOR	MAXLENGTH/8
	spl	$0,	$1
	jmp	$-1,	{-1
	ROF
	FOR	MAXLENGTH/4-3
	dat	$0,	$0
	ROF

start	nop	}1,	0
	nop	}1,	>1
	spl	#0,	{1
	mov	$1,	{1
	mov	>-1,	{0
	dat	{-1,	{-1

	FOR	MAXLENGTH/4-3
	dat	$0,	$0
	ROF
	FOR	MAXLENGTH/8
	spl	$0,	$1
	jmp	$-1,	{-1
	ROF

	end	start

