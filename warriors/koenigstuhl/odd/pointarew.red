;redcode
;name PointA Rewritten
;author Lukasz Adamowski
;assert 1

result	EQU	start
m3	EQU	332
m2	EQU	333
m1	EQU	334
off	EQU	10
	FOR	ROUNDS>CORESIZE
val	EQU	CORESIZE/2
	ROF
	FOR	ROUNDS<=CORESIZE
val	EQU	ROUNDS/2
	ROF

start	ldp	#0,	result
	seq	#-1,	result
	jmp	noinit
cnt	FOR	27
	stp	#val,	#off+cnt-1
	ROF
noinit	ldp	#m3,	last
	add	last,	ptr
	mul	#3,	ptr
	ldp	#m2,	last
	stp	last,	#m3
	add	last,	ptr
	mul	#3,	ptr
	ldp	#m1,	last
	stp	last,	#m2
	add	last,	ptr
;	mul	#3,	ptr
	add	#off,	ptr
	ldp	ptr,	last
	sne	#1,	result
	add	#2,	last
	sub	#1,	last
	stp	last,	ptr
	sub	#off,	ptr
	mod	#9,	ptr
	mul	#3,	ptr
	add	#off,	ptr
	ldp	ptr,	s1
	nop	>ptr,	0
	ldp	ptr,	s2
	nop	>ptr,	0
	ldp	ptr,	s3
	slt	s1,	s2
	jmp	skip1,	0
	slt	s2,	s3
	mov.a	#-1,	choice
	add.a	#2,	choice
	jmp	skip2,	0
skip1	slt	s3,	s1
	mov.a	#2,	choice
skip2	stp.ab	choice,	#m1
choice	jmp	@0,	$gate
	dat	$0,	$imp
	dat	$0,	$clear
ptr	dat	$0,	$0
s1	dat	$0,	$0
s2	dat	$0,	$0
s3	dat	$0,	$0
last	dat	$0,	$0

	dat	0,	0
	dat	0,	0
	dat	0,	0
	dat	0,	0
;strategy Core clear
pntr equ clear-3
clear: mov bmb,}pntr ;<-- must start here
mov bmb,}pntr
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
