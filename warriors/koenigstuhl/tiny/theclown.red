;redcode-tiny
;name The clown
;author G.Labarga
;strategy c/i
;assert CORESIZE==800

	gate equ clear-4
	iloc equ clear+60
	cloc equ clear+240 ;-100 ;240

clear:	spl #4,}gate
	mov bmb,>gate
	djn.f -1,>gate
bmb:	dat <267,<8
;for ssss
;	dat 0,0
;rof
	dat iloc+6*267	,iloc+7*267
	dat iloc+4*267	,iloc+5*267
	dat iloc+2*267	,iloc+3*267
vect:	dat iloc+0*267	,iloc+1*267
start:	mov.i #267,*-1	; imp,iloc
boot:	mov {clear,{clgo
	mov {clear,{clgo
	mov {clear,{clgo
	mov {clear,{clgo
clgo:	spl *cloc,>iloc
	spl 1	,iloc+3*267
	spl 1	,iloc+2*267
sprd:	spl 2	,iloc+1*267
	djn.a *vect,#iloc
	djn.a @vect,#0
	;spl @vect,{0
	;jmp @-2,{0
;djn.a ,#

	end start
