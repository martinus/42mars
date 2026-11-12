;redcode
;name Universal Switch-Board
;author Lukasz Adamowski
;assert 1

mgc	EQU	13
g	EQU	gate
c	EQU	clear
i	EQU	imp


rslt	dat	0,	0
start	ldp.a	#0,	rslt
	ldp.a	#mgc,	strtg
	add.a	rslt,	strtg
	stp.ab	*strtg,	#mgc
	nop	1,	g
strtg	jmp	@0
	dat	7,	c
	dat	4,	i
	dat	1,	g
	dat	1,	g
	dat	7,	c
	dat	4,	i
	dat	1,	g
	dat	9,	c
	dat	7,	c
	dat	11,	i
	dat	9,	c
	dat	14,	g
	dat	11,	i
	dat	11,	i
	dat	9,	c
	dat	14,	g

	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
;strategy Core clear
ptr equ clear-3
clear: mov bmb,}ptr ;<-- must start here
mov bmb,}ptr
jmp -2
bmb: dat 7,0
	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
;strategy Imp-gate, (wimp)
gate: jmp #0,<-3
;strategy Imp
imp: mov.i #4,1

	end	start