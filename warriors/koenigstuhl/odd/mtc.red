;redcode-94odd
;name ModTrickCalculator
;author Roy van Rijn
;assert 1

; This program works from 0-18 processes
; Fill this variable with the amount of processes needed

amount	equ	6

; Here we calculate the
; mod.x #fib(n+1)	, #fib(n+2)

	mov.x	F		, F
S	add.ab	F		, F
	djn.b	-2		, #amount
	mov.i	F		, the_mod
	jmp	test_it
	dat	0		, 0
	dat	0		, 0
	dat	0		, 0
F	mod.x	#1		, #1
	dat	0		, 0
	dat	0		, 0
	dat	0		, 0

; Now we test the mod we created
; First we create a lot of processes and
; let them loose on the mod:

test_it spl	1
	spl	1
	spl	1
	spl	1
	spl	1

the_mod	mod.x	#1		, #1

see_it	nop	>0		, #0

; The B-field records how many times it is executed

end S

