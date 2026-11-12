;redcode-94
;name MC#5 derivator 2
;author Neogryzor
;assert 1
;stategy	Calculates the N-th derivate of an equation of the form:
;strategy	A0 + A1*X^1 + A2*X^2 + A3*X^3 + ... = 0
;strategy	Based on David Houston's routine

;data table is built using the MUL.BA #,# instruction. An terms are in the A-field, n must be
; in the B-field. 
;The table is located before the code, from X^1 to X^n and finally X^0, wich is used as a
; self-resetting pointer
;Once the calculation has ended, X0 must ignored, taking the result from EQUAT to X0-1.

	N EQU 3	;derivate N times

		;7x^4-5x^3-2x^2+3x+1 for example

EQUAT:	MUL.BA #3  ,#1	;x^1
	MUL.BA #-2 ,#2	;x^2
	MUL.BA #-5 ,#3	;x^3
	MUL.BA #7  ,#4	;x^4
X0:	MUL.BA #1  ,#0	;x^0
	DJN.B #0,{X0
NEXT:	DJN.B *X0,#N

	END EQUAT
