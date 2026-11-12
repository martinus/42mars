;redcode-94nop
;name 	Return of the Boss
;password...
;author G.Labarga
;assert CORESIZE==8000
;startegy	bombing bishot-style scanner
;strategy	0.4c bomb, 0.4c scan

	DECOY EQU SCAN+2001
	STEP EQU 335	;<-67*5
	D1 EQU 2*STEP
	D2 EQU 3*STEP

GATE:	DAT SCAN-335,SCAN-335
FOR 7
	DAT 0,0
ROF
INC:	SPL #-4*STEP,<-4*STEP
CLOP	MOV BM1,}GATE
	MOV BM2,>GATE
DIR:	DJN.A CLOP,{GATE-1 ;<- no funciona bien
	DAT 0,0
BM2:	DAT 15,<2667+15
BM1:	SPL #15,2667+15
FOR 34
	DAT 0,0
ROF
LOOP:	SUB.F INC,SCAN		;scan
GO:	MOV BMB,*SCAN
	MOV BMB,@SCAN
SCAN:	SNE.I @D1,@D2		;<- A-scan
	DJN.F LOOP,>START+5 ;3	;<SCAN+3120+62-8
	ADD.F SCAN,GATE
	JMP INC,{0
BMB:	DAT <2667,-2*STEP
FOR 26
	DAT 0,0
ROF
START:	MOV.I {DECOY,<DECOY+5		;transparent ~3c decoy maker
	MOV.I {DECOY+1,<DECOY+8		;for not to trigger the clear
	MOV.I {DECOY+6,<DECOY+3
	DJN.F SCAN,<DECOY+11

	END START
