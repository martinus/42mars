;redcode
;name Staper
;author Lukasz Adamowski
;assert 1

; Redcoders Frenzy Ronud 14th second entry

STEP	EQU	1604

w1	add	#STEP+1,	$3
	mov	@-1,	<2
	jmp	$-2,	$0
	spl	$0,	<-3	; !!! < in B-field !!!

res: ldp #0,      res
str: ldp pkey,    0
     cmp #1,      res
     add #4000,   str
     stp str,     pkey
     slt #3999,   str
     jmp w2
pkey:jmp w1,      #47

w2	spl	1
	spl	1
	spl	1
	mov	<8,	<1
	spl	@0,	$3113
	mov	<8,	<1
	spl	@0,	$373
	mov	$4,	<-1
	mov	$3,	<-2
	djn	$-1,	$-3
	mov	0,	1

     end res

