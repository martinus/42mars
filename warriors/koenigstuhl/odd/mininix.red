;redcode-94
;name MiniNiX
;author Jakub Kozisek
;strategy blur-ish scanner? maybe ... just for phun!
;assert 1
;       CORESIZE==800

dist 	equ 	180
step 	equ 	5

gate	equ	(top-3)

	org 	start

; #### SCANNER ####

top    	mov.b  	2, 	#dist
loop    mov.i  	split, 	>top
        add.ab	#step,	#10
start   djn.f   top,    @-1
        jmn.b   loop,   *top

split  	spl   	#1,	#1
clear   mov.i	bomb,	>gate
	mov.i	bomb,	>gate
        jmp 	clear, 	{gate

bomb    dat    	<267,	7-gate

        end
