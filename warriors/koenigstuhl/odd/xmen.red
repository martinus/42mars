;redcode
;name X-Men United
;author Lukasz Adamowski
;strategy NTW = Never Tested Warrior
;assert 1

value equ 3456  ; just for Koenigstuhl [CCB]

ball	EQU	value
goal	EQU	value
kill	EQU	eyes

start
	seq	}eyes,	<eyes
	spl	$see
	djn	$start,	$eyes
	dat	$0,	$0
see
	mov	$eyes,	$glasses
	nop	{glasses,	{glasses
	sne	@glasses,	#ball
	jmp	$kickright
	sne	*glasses,	#ball
	jmp	$kickleft
	sne	@glasses,	#goal
	jmp	$lookright
	sne	*glasses,	#goal
	jmp	$lookleft
	mov	$stun,	*glasses
	mov	$stun,	@glasses
	dat	$0,	$0

kickleft
	sub.a	$glasses,	$foot
	mov	*glasses,	@eyes
	mov	$foot,	*glasses
	jmp	$0,	$0
kickright
	sub.ba	$glasses,	$foot
	mov	*glasses,	@eyes
	mov	$foot,	@glasses
	jmp	$0,	$0

lookleft
	mov.a	$glasses,	$mind
	seq.a	$glasses,	$mind
	add.a	#9,	$mind
	dat	$0,	$0
lookright
	mov.ba	$glasses,	$mind
	seq.ba	$glasses,	$mind
	add.a	#9,	$mind
	dat	$0,	$0

foot	jmp	$run-glasses,	$0

run	seq	#goal,	{mind
	jmp	$run,	{mind
stun	spl	#0,	$0
	mov	$kill,	*mind
	mov	$kill,	{mind

;	FOR	70
;	dat	$0,	$0
;	ROF

eyes	dat	$5266,	$5266
glasses	dat	$0,	$0
mind	dat	$5265,	$0
	
	end	start
