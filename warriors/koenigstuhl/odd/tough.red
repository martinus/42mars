;redcode-94x
;name Tough enough
;author G. Labarga
;strategy another paper/imp
;strat	  Round 9 , Entry #1; Redcoders Frenzy Tournament. April 2003
;strat	  3-split silk+1p imp
;assert 1
; CORESIZE==55440

INI:	ADD.F #1,@1
	ADD.F 1,1
	MUL.F #1,#1	;16,16 /16,256
	MUL.B <1,-1
	SUB.AB @-1,-1	;-1,-2
	ADD.BA {1,@-1
	ADD.F @-1,@1
SET1:	MOV.B 1,*1
CTE1:	MUL.AB #0,#-1	;\14,239 |14,3346
	ADD.X -1,1
CS2:	MOV.AB #1,0	;3347,14
	ADD.X -1,@1
	SUB.AB 1,1
CTE3:	MUL.AB #1,#-1	;15,49965 (3*5*3331:prime? looking good)
	MUL.X <1,*-1
	MUL.B @-1,*-1
	ADD.AB @-1,}1
	DIV.AB #1,1
	ADD.F @0,1
	SPL 1,{0
	SPL 1
	SPL 1
PAP1:	SPL @0,0	;0,239
	MOV }-1,>-1
PAP2:	SPL @0,0	;0,3345
	MOV }-1,>-1
	MOV {-1,{1	;-2,2
	MOV.I #1,<1
PAP3:	SPL *1,<-1	;49965,26685
IMP:	MOV.I #1,}0	; Impy :)
FOR 20
	DAT 0,0
ROF
FOR ((MAXLENGTH-CURLINE)/4)	;Decoy
	DAT #1,$1
	DAT @1,}1
	DAT *1,{1
	DAT >1,#1
ROF
	END INI

