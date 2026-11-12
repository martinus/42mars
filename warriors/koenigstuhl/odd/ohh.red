;redcode
;name Ohh, God ....
;author Jakub Kozisek
;strategy ...paper?!? again?!?
;       CORESIZE==800
;assert 1

	org 	start

P_STEP1 equ     75
P_STEP2 equ     243
P_STEP3 equ     615

; #####################################

start  	spl     1,	<243
	spl	1,	{317
	spl	1, 	<437

cp1     spl     @0	<P_STEP1	; make 1st copy
        mov     }cp1,	>cp1
cp2     spl     @0, 	<P_STEP2	; make 2nd copy
        mov     }cp2,   >cp2
	mov.i	bomb,	<-130
        mov     {cp2,   {cp3		; make 3rd copy
cp3     djn.f	P_STEP3,<150		; jump there
bomb	dat	<267,	{267

        end
