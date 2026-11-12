;redcode-94
;author G.Labarga
;name No resources
;assert 1
;strategy Go for 2 points
;strategy simple paper/S-clear

	cte1 equ 5104

start:	spl 1
	spl 1	

pap0:	spl cte1,0
	mov >pap0,}pap0
	mov >pap0,}pap0
sbm:	spl #5,}0
loop:	mov imp,}sbm
	mov sbm,}sbm
pt:	jmp loop,}sbm
imp:	mov.i #1,1

	end start