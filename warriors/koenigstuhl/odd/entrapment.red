;redcode
;name Entrapment
;author Lukasz Adamowski
;assert 1

DATS	EQU	78

chck1	dat	$0,	$0
	dat	$0,	$0
	dat	$0,	$0

start	mov	$imp,	$ptr+1
	mov	$imp,	$ptr+2
	mov	$imp,	$ptr-4
	jmn	$go1,	$chck1
	jmz	$start,	$chck2
go2	nop	>chck2,	>chck2
	mov	$wait,	@chck2
	jmp	@chck2
wait	jmn.b	#0,	$-2
go1	nop	}chck1,	}chck1
	mov	$wait,	*chck1
	jmp	*chck1
imp	mov.i	#0,	$1

	dat	$0,	$0
	dat	$0,	$0
chck2	dat	$0,	$0
	dat	$0,	$0
	dat	$0,	$0

; Dummy :]
    mov ptr , >ptr
    mov ptr , {ptr
cnt djn -2  , #-5
ptr dat -3  , 2
	dat	$0,	$0
i	FOR	DATS-5
	dat	$-2-i,	$1+i
	ROF

	end	start
