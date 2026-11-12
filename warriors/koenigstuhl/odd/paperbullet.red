;redcode
;name Paper Bullet
;author Lukasz Adamowski
;assert 1

STEP	equ	12

trg	dat	$0,	$0
	FOR	10
	dat	$0,	$0
	ROF
bmb	dat	}3,	<5143
back	spl	#0,	<trg
	add	#STEP+2,	$trg
	mov	$bmb,	<trg
	add	#STEP+2,	$trg
	mov	$bmb,	<trg
	djn	$-2,	<trg

start	spl	back
	jmp	paper

	FOR	50
	dat	$0,	$0
	ROF

paper	spl	1
	mov	-1,	0
	spl	1
	spl	712,	0
	mov	>-1,	}-1
	spl	423,	0
	mov	>-1,	}-1
	mov	>1,	{-1
	jmp	$-1,	}1

	end	start
