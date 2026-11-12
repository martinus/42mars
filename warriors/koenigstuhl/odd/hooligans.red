;redcode-odd
;name Hooligans and Thugs
;author Chip Wendell
;strategy Entry for Redcoders Frenzy #21
;strategy Start with a sparse bombing run,
;strategy  then search for ball and goal.
;strategy Show no mercy!
;assert CORESIZE==8000

value equ 3456  ; just for Koenigstuhl [CCB]

goal	equ	value
ball	equ	value

top
savegoal  mov.ab  #ptr-kicker, kicker
	add.b	ptr,	kicker			;Get the location of the goal
	jmp	next

vamp	mov.ab	#kicker-ptr, vbomb
	sub.b	ptr,	vbomb			;Vamp the ball into the kicker
	mov	vbomb,	@ptr
	jmp 	next
vbomb	jmp	@0,	kicker-ptr

check	slt	#bottom-ptr, ptr		;Are we seeing ourselves?
ptr	dat	0,	top			; ... Yes; we can't win
	add	#2,	ptr	
loop	sne	<ptr,	dat0
	jmp	next
	sne	@ptr,	theball
	jmp	vamp
	sne	@ptr,	thegoal
	jmp	savegoal
	mov	@ptr,	test
	sub.f	test,	test
	seq	test,	goaltest
	mov	theball, @ptr
next	djn	loop,	#2
	mov	#2,	next			;Reset count for next time

;Scan for the ball and goal
sloop	cmp	<ptr,	<ptr
	jmp	check
	cmp	<ptr,	<ptr
	jmp	check
	cmp	<ptr,	<ptr
	jmp	check
	djn	sloop,	#(CORESIZE-MAXLENGTH)/6 + 1
dat0	dat	0,	0			;Missed everything - suicide

kicker	mov.i	ptr,	ptr
	jmp	@0,	kicker
test	dat	0
goaltest	jmp	#0,	#0
thegoal	jmp	#0,	#goal
theball	jmp	#0,	#ball

;Start with a quick bombing run
start
i	for	31
	mov	theball,	top+((i-1)*200)+120
	mov	theball,	top+((i-1)*200)+121
 	rof
bottom	jmp	sloop

	end	start

