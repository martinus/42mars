;redcode-94
;name MC#5 derivator
;author Neogryzor
;assert 1
;stategy	Calculates the N-ish derivate of an equation of the form:
;strategy	A0 + A1*X^1 + A2*X^2 + A3*X^3 + ... = 0 ,(Ax can be <0 or >0)

	N EQU 1

NEXT:	MOV.F #2,@1
LOOP:	MOV.F }INDEX,@INDEX
	MUL.B INDEX,>INDEX
	JMN.F LOOP,*INDEX
	MOV.F *INDEX,@INDEX
	DJN.B NEXT,#N		;N-ish derivate
INDEX:	JMP #2,1
EQUAT:	DAT 1,3		;3+2x-5x^2+x^3 for example
	DAT 1,2
	DAT 2,5
	DAT 1,1

	END LOOP
