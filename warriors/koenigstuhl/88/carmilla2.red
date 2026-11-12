;redcode-88
;name Carmilla2
;author Campbell Fraser
;assert 1

GAP     equ 2

	; Drop a JMP instruction on target to steal thread
BITE	mov TEETH, @TEETH
	add TOOTH, TEETH
LOOP	djn -2, #3950

	spl 0
	jmp TRAP
BOMB	dat #666, #(BITE-1)
TARGET	dat #0, #BITE

TRAP	mov BOMB, <TARGET
	spl TRAP
	spl TRAP
	spl TRAP
	jmp TRAP

TEETH   jmp CAPTURE + 14, -14
TOOTH	dat #GAP, #-GAP
	
	spl (TRAP - LOOP)
CAPTURE	mov -1, LOOP
	jmp TRAP
