;redcode
;name     Random Scandom
;author   Ben Ford
;strategy scanner
;assert   1

STEP	equ	5379
gate	equ	(sinc-2)

sptr	dat	    0,	 STEP
sinc	add	#STEP,	#STEP*2
	mov	 sclr,	>sptr
scan	jmz.f	 sinc,	@sinc
	slt	 sinc,	#send-sptr
	mov.b	 sinc,	 sptr
	jmn	 sinc,	 sinc
sclr	spl	    0,	    0
	mov	 send,	>gate
	djn.f	   -1,	>gate
send	dat	    0,	 send+2-gate

end scan

