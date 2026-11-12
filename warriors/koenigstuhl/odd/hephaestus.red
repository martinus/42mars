;redcode-94
;name Hephaestus
;author David Houston
;assert 1

start:	spl Z

bstep	equ	4 * 11

;bomber
	spl	#0, <399
inc:	spl	#bstep * 2, <bstep * 2
	add.f	inc, bomb
	mov	bomb, @bomb
	mov	bomb, *bomb
	jmp	-3, <602
bomb:	dat	-5, -5 + bstep


;imp launcher out of corewarrior 004
step	equ	267

	dat	0
	dat	0
Z       spl     Z, <422
A       spl     C, }D
B       spl     E, }E
D       jmp     imp-2, }D
E       jmp     imp+step-1, }E
C       nop     }F, <201
F       jmp     imp+2*step-1, }F
imp     mov     0, step
