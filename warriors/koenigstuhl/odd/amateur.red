;redcode-odd
;name NTW Amateur Football Club
;author Lukasz Adamowski
;strategy NTW = Never Tested Warrior
;assert 1

value equ 3456  ; just for Koenigstuhl [CCB]

ball	EQU	value
goal	EQU	value

lfoot	EQU	run-110
;rfoot	EQU	play+99

play	jmz.b	#0,	<lfoot
	sne	#ball,	@lfoot
	jmp	$kick
	seq	#goal,	@lfoot
	jmp	$play
	add.b	$lfoot, $head
	mov.b	$head,	$rfoot
;	nop	<rfoot,	<rfoot
	nop	}run,	}run
	jmp	$play,	}run

kick	sub.ba	$lfoot,	$jump
	mov	$jump,	@lfoot
head	jmp	$play,	$lfoot-6
jump	jmp	$110

run	jmz.b	$0,	>rfoot
	seq	#goal,	<rfoot
	jmp	$run,	>rfoot
rfoot	mov	$kill,	$play+99
        jmp	$0

kill	dat	{-1,	>1

FOR	5
        dat	$0,	$0
ROF
FOR	25
	djn	$5,	#5
	spl	@1,	#23
	mov	}-1,	>-1
ROF

	end	play
