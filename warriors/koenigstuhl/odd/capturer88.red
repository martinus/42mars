;redcode
;name The Capturer '88
;author Lukasz Adamowski
;assert 1

tdat	EQU	bdat

start	mov	$bjmp,	<tjmp
	djn	$-1,	$tjmp
	jmz	$0,	<tdat
	mov	$bdat,	@tdat
	mov	$bdat,	<tdat
	jmz	$-3,	$chck
	mov	$0,	$1
bdat	dat	#-1,	#-10
chck	dat	#0,	#0
	dat	#1,	#1
bjmp	jmp	$0,	$0
	FOR	CORESIZE%2==0
tjmp	dat	#0,	#-14
	ROF
	FOR	CORESIZE%2!=0
tjmp	dat	#0,	#-13
	ROF

	end	start

