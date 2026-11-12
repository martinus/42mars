;redcode-94nop
;name Kenshin C twra
;author Steve Gunnell
;strategy Mirage style scanner with decoy.
;assert CORESIZE==8000


	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#0	, #0
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	spl	#1	, #1
	dat.f	$0	, $0
	dat.f	$0	, $0

STEP	equ	6497
START	equ	7241
LEAP	equ	(head+2937)
bptr	equ	(head-2)

bGo	mov.i	<boot	, {boot
    for 9
	mov.i	<boot	, {boot
    rof
boot	spl	LEAP+10	, head+10
	sub.f	boot	, boot
	dat.f	0	, 0

head	slt	#START	, #tail-bptr+5
	mov.a	head	, bptr
trash	mov	*tail	, }bptr
	add.a	#STEP	, @hptr
	jmz.f	trash	, *head
hptr	jmn.a	@hptr	, head
	jmp	@hptr	, }tail
tail	spl	#0	, }0
	dat 0, 0
	spl #0, {0

      end    bGo
