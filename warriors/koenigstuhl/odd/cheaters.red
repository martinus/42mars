;redcode-rf21
;name cheaters
;author Christopher Hubert
;strategy hyper-obese scanner probably
;stratedy destined for last place
;strategy but who cares? :-)
;assert 1

value equ 3456  ; just for Koenigstuhl [CCB]

goal	equ	value
ball	equ	value

step	equ	4293
lenth	equ	24

org	scan

for 21
	jmp	#0,	#ball
rof

for 55
	dat	0,	0
rof

wait	djn.a	#0,	#clr
inc	add	#step,	@scan
scan	jmz.f	inc,	@ptr
	slt	#0-lenth,	ptr
mov.f	@scan,	dir
	spl	wait,	}dir
	jmn	clr,	ptr
	sub.f	#1,	clr
	spl	#0,	#0
clr	mov	bomb,	>dir
	jmn.a	clr,	@clr
bomb3	dat	goal,	0
bomb2	jmp	0,	ptr
bomb	jmp	#0,	#0
dir	spl	#0,	#0
scanv	seq.x	bomb3,	>ptr
	jmp	scanv
	mov.b	ptr2,	ptr3
kick	mov	bomb3,	<ptr3
ptr2	jmp	kick,	ptr+1
ptr3	jmp	dir,	wait-1
	jmp	ptr3
ptr	dat	13,	step

