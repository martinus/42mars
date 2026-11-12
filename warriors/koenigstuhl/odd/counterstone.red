;REDCODE-94
;NAME 	Counter stone
;AUTHOR German Labarga
;ASSERT CORESIZE==8000

;STARTEGY	rosebud-like bomber
;		Sorry, I have no time for an original warrior

	STEP EQU 6

DESP:	MOV >STEP,{-STEP
LOOP:	MOV >STEP*2,1-STEP*2
	ADD DESP,LOOP
	JMP LOOP,DESP

	END DESP


