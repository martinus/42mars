;redcode-94
;name	Kick them all!
;author	G.Labarga
;assert 1
; CORESIZE==55440

;strategy	Round 9 , Entry #2; Redcoders Frenzy Tournament. April 2003
;strategy	Mini single switcher(2)
;strategy	Switch on loss (2 components: paper<->stone)
;strategy	*Paper: 3-split silk
;strategy	*Stone: 0.5c bomber -> DAT-clear
;strat	I can't write an effective scissors component with such settings, so adaptative..
;strat	.. switching is useless. Paper is very powerful in this round, (only 10^5 cycl.)
;strat	The stone will gain some extra points if the opponent has an effective scanner
;strat	No P-Key version, sorry.
;strat	Brainwashing? who cares? Maybe a vampiric paper could be dangerous.. (bah!)
;strat		SIZE: 74 + DECOY

;--------(*) The P-brain ------------------ size 11, (P-brain:6, select:5)
START:	LDP.AB #0,>1		;Load last round result
	LDP.AB #1,1		;Load last strategy
RESULT:	JMN.B }1,#0		;1,RESULT
STRAT:	ADD.AB 1,#0		;2,STRAT
	MOD.AB -1,-1		;(MOD #2)
	STP.B @-1,#1		;Save last strategy
;-- go to component---
	ADD.F {-1,@1	;Component selection
	ADD.F 1,1
SREF:	MUL.AB #0,#0	;|4,0 or 4,8
	MUL.AB {1,<1	;\4,0 or 4,32
	JMN.B @-1,-1	;@-2,-2 , could be @-2,@0; Jumps to the selected component
;-------(*) The paper: -------------------------------size 29 ins.
IPAP:	ADD.F #1,@1
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
	SPL 1
	SPL 1,}0
	SPL 1
PAP1:	SPL @0,0	;0,239
	MOV }-1,>-1
PAP2:	SPL @0,0	;0,3345
	MOV }-1,>-1
	MOV {-1,{1	;-2,2
	MOV.I #1,<1
PAP3:	DJN.F *1,<-1	;49965,26685
;-------(*) The stone: ------------------------------- size 34 ins.
;Annoyingly tricky
;(STEP EQU 17*4 nice mod 4 constant)
ISTO:	ADD.F #1,@1		;Constants initialization
	MUL.F 1,1
	MUL.AB #1,#1	;4,16
	ADD.F -1,1
	MUL.AB #0,#1	;4,17*4 <- The bombing step
	MOV.X <1,*-1
	ADD.AB @0,*-1	;0,-2
	MOV.F @-1,@1
	ADD.A #0,*0	;#17*4,*8
	DJN -1,#1
	ADD.B *-1,1
	ADD.AB {-1,-1	;-1,7
	ADD.BA <1,*1
	SUB.A #1,@-1	;1,-2
	JMP >1		; >8,0 Jumps to Boot
	DAT 0,0		;Not executed		;(16 ins)
;--------------- STONE ITSELF-------------\.
BOMB:	DAT 0,0			;4,STEP
STO:	SPL #-1,1
	MOV.I -1,>1		;-1,1+STEP
HIT:	MOV.I *-1,@-1		;-2,-1
	ADD.AB #0,@-1		;2*STEP,-1
	DJN.F -1,<-1		;-3,27719
;-----------------------------------------/ 	;(22 ins)
	DAT -1,1	;-1,2
BOOT:	SUB.BA -1,*-1	;/1,-2	;Well, no boot yet, still initializing
	DIV.B @-1,{-1
	ADD.BA {-1,1	;Now setting up boot constants
	DIV.AB #1,#-1	; 3,18479 /6,18479 
	ADD.A -1,-1
	MUL.BA >1,@-1
BPTR:	ADD.F <-1,<1	; -7,18481	Boot pointer
	MOV.I {-1,<-1
	JMN.F -1,*-1	;-1,-2
	ADD.B @-1,1
GOSTO:	JMP <0,-1				;(34 ins)
;-------(*)The decoy -----------------------------------
FOR 20
	DAT 0,0
ROF
FOR ((MAXLENGTH-CURLINE)/4)
	DAT #1,$1
	DAT @1,}1
	DAT *1,{1
	DAT >1,#1
ROF
;---
	END START
;------------------------------------------- ;That's all, folks!

