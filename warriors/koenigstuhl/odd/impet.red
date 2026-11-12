;redcode
;name Impet
;author Lukasz Adamowski
;assert 1
;sent to: achillu@tin.it

A	EQU	0
B	EQU	1
C	EQU	2
D	EQU	188
E	EQU	110
FORMULA	EQU	(A+B*x)*(A+B*x)/C-D*x+E

x	FOR	47
	mov	imp,	imp+FORMULA
	ROF
x	FOR	47
	spl	imp+FORMULA
	ROF
	mov	imp+1,	imp+4000
	mov	imp+1,	imp+4001
	spl	imp+4000,	>imp
imp	mov.i	#0,	1
	mov.i	#0,	2

