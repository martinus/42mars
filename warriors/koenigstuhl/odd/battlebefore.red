;redcode
;name Battle Before The Dawn Began
;author Lukasz Adamowski
;assert 1

; Redcoders Frenzy Ronud 14th first entry

; stunning stone -> multipass 1/3c coreclear
; '88 of course ;]

STEP	EQU	1604

stone	add	#STEP+1,	$3
	mov	@-1,	<2
	jmp	$-2,	$0
	spl	$0,	<-3	; !!! < in B-field !!!

w6	EQU	scan
w7	EQU	nuts
w8	EQU	mill
w9	EQU	stone
w10	EQU	stone
w11	EQU	paper1
w13	EQU	paper2

res: ldp #0,      res
str: ldp pkey,    0
     cmp #1,      res
     add #4000,   str
     stp str,     pkey
     slt #3999,   str	;;;;
     jmp w2
pkey:jmp w1,      #47

w5	ldp	p5,	0
s5	cmp	#1,	res
	add	#4000,	w5
	stp	w5,	p5
	slt	#3999,	w5
p5	EQU	paper1
;p5	jmp	w11,	#5
;	jmp	w13

; '88 agressive paper

paper1	mov	#5225,	$5
paper2	spl	1
	spl	1		;;;
	mov	-1,	0
	mov	<7,	<1
	spl	@0,	$3113	; 1771-76 1991-34 5225-15! 1791-43 3113-21! 
	mov	<7,	<1
	spl	@0,	$373
	mov	$3,	<-1
	djn	$-1,	$-2
	mov	0,	1

	dat	#0,	#0
	slt	#3999,	$-4	;;
	dat	#0,	#0
	dat	#0,	#0

w3	ldp	p3,	0
s3	cmp	#1,	res
	add	#4000,	w3
	stp	w3,	p3
	slt	#3999,	w3
p3	jmp	w7,	#3
	jmp	w9

; 1c scanner -> coreclear

pets	EQU	890

check	cmp	$zero,	@scan	;
	add	$scan,	$point
	cmp	$zero,	@scan
	add	$scan,	$point
	sub	$scan,	$point
	jmp	stun
zero	dat	#0,	#0
step	dat	#-pets,	#pets
point	dat	#0,	#0
loop	add	$step,	$scan
scan	cmp	$-20,	$20
	jmp	$check,	$4000
	jmz	$loop,	<-1
	mov	$-2,	$point
stun	add	#8,	$point
	spl	$1
	spl	$1
	spl	$1
	mov	$nuts,	<point
	mov	$nuts,	<point
nuts	spl	$0		;
	mov	$zero,	<zero
	mov	$zero,	<zero
	jmp	$-1

	dat	#0,	#0
	dat	#0,	#0

w4	ldp	p4,	0
s4	cmp	#1,	res
	add	#4000,	w4
	stp	w4,	p4
	slt	#3999,	w4	;;
p4	jmp	w8,	#4
	jmp	w10

w1	ldp	p1,	0
s1	cmp	#1,	res
	add	#4000,	w1
	stp	w1,	p1
	slt	#3999,	w1
p1	jmp	w3,	#1
	jmp	w5

	spl	1		;;;

; 3-pointed imp spiral

STEP2	EQU	2667

imp	mov	$0,	$STEP2
mill	spl	1
	spl	1
	spl	1
	spl	2
spi1	jmp	@0,	$imp
	add	#STEP2,	$-1

	dat	#0,	#0
	dat	#0,	#0
     slt #3999,   $-4	;;;;

w2	ldp	p2,	0
s2	cmp	#1,	res
	add	#4000,	w2
	stp	w2,	p2
	slt	#3999,	w2
p2	jmp	w4,	#2
	jmp	w6

     end res

