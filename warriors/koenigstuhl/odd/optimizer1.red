;redcode
;name optimizer 1
;author El Kauka
;assert 1

	start	equ	4	;startvalue of genotyp
	step	equ	1	;value to add on lost

org	load

space	dat	0,		0
first	dat	0,		-1
won	dat	0,		1

load	ldp	#0,		space   
	sne.b	first,		space   
	stp	#start-step,	#1	

	ldp.a	#1,		gen	

	seq.b	won,		space	

	sub.a	#1,		1
	jmp	2,		0
	jmp	lost			
	jmp	win			

lost	add.a	#step,		gen	
	stp.ab	gen,		#1	
	jmp	fighter			

win	ldp	#1,		count	
	ldp.a	#1,		1
	ldp.a	#23,		count
	add.a	#1,		1	
count	stp	#1,		#1	


fighter

;simple dwarf
	mov	3,		3
gen	add	#1,		-1
	jmp	-2

