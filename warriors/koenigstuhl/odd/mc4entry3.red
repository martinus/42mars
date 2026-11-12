;redcode

;name More eXperiments

;author Lukasz Adamowski

;assert 1

;	***** SCORE: 63.6% 3-way ties *****

LENGTH	EQU	8



start	add	step,	comp

comp	sne	-550,	550	;550

	jmp	-2

	mov	pill,	{comp

	mov	pill,	<comp

	jmp	start

step	dat	-4,	4

pill	jmp	0



	FOR	MAXLENGTH-2-2*LENGTH

	dat	1,	-1

	ROF



boot	mov	start,	start+4000

	FOR	LENGTH

	mov	}boot,	>boot

	ROF

	jmp	start+4000+1, 	}2000



	end	boot
