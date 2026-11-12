;redcode-rft22
;name CRIVENS!
;author el kauka
;strategy q^4? + boot + clp
;strategy handshaker (slave)
;assert 1

pin 765

	aim	equ		695		;clp copy distance 
	away	equ		-192		;boot distance
	guard	equ		34		;cmp steps awy from clp
	atc	equ		5		;gap between qscan attack
	base	equ		-32		;hop between q scan

org hand
	
hand	ldp.a	#223,		1		;handshaker
	sne	#0,		#98
	jmp	qs
	stp	#98,		#223
	dat	0,		0

qs	sne.i	base,		base*4		;q scan
	seq.i	base*2,		base*3
	jmp	attack,		{pointer
x	sne.i	base*5,		base*8
	seq.i	base*6,		base*7
	jmp	attack		
	sne.i	base*9,		base*12
	seq.i	base*10,	base*11
	jmp	attack,		}pointer
	add.ab	#10,		pointer

	sne.i	base*13,	base*16
	seq.i	base*14,	base*15
	jmp	attack,		{pointer
	sne.i	base*17,	base*20
	seq.i	base*18,	base*19
	jmp	attack		
	sne.i	base*21,	base*24
	seq.i	base*22,	base*23
	jmp	attack,		}pointer	

	jmp	start			

pointer	dat	#0,		x		;q scan pointers
qinc	dat	#-atc,		#atc
qptr	dat	0,		0
bptr	dat	p,		p+away		;boot pointer

attack	mul.a	#3,		pointer		;calculate position
	add.ab	pointer,	pointer		;to attack
	mov.f	@pointer,	qptr

loop	mov.i	bmb,		*qptr		;q scan attack
	mov.i	bmb,		@qptr
	add.f	qinc,		qptr
	djn.b	loop,		#15

start	spl	0,		}0		;ALT 2 - 3 processes
	
boot	mov.i	}bptr,		>bptr		;boot
	mov.i	}bptr,		>bptr
	mov.i	}bptr,		>bptr
	jmp	p+1+away,	}0	

p	dat	0,		aim		;clp
	mov.i	bmb,		>15
	sne.i	-guard,		guard
	djn.f	-2,		{13
	mov.i	}p,		>p
	mov.i	}p,		>p
	mov.i	}p,		>p
	jmp	aim-6			
bmb	dat	<-70,		}40


end
