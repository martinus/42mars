;redcode-88
;name Carmilla
;author Campbell Fraser
;assert 1

GAP     equ -108
GAP2    equ -54

FOCUS   add INC, LOOK
LOOK    cmp -62, -8
        slt #100, LOOK
JB      jmp -3
	
	; Drop a JMP instruction on target to steal thread
	mov TOOTH, TEETH   ; Prepare
	sub LOOK, TEETH    ; Aim
	mov JMP1, @LOOK    ; Bite
	mov TEETH, <LOOK   ; Suck

	; Re-aim and return to searching or exit
        add REFOCUS, LOOK
        jmp LOOK

	dat #0, #0

REFOCUS mov @GAP2, <(GAP2+1)
INC     dat #GAP, #GAP

	jmp (BAT1 - FOCUS)
CAPTURE	mov -1, FOCUS

CLEAR	mov (FOCUS-1), <(FOCUS-1)
	spl CLEAR, <(FOCUS-2)
	spl CLEAR, <(FOCUS-2)
	spl CLEAR, <(FOCUS-2)
	jmp CLEAR,<(FOCUS-2)

JMP1	jmp -1
TEETH   jmp 0
TOOTH	jmp -40

IMP	mov 0, 1
BAT1	mov IMP, 200
	spl 199

	; Modified mice by Chip Wendell
	mov #7, -1
	mov @-2, <5
	djn -1, -3
	spl @3, 0
	add #653, 2
	jmz -5, -6
	dat #0, #832

	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
	dat #0, #0
