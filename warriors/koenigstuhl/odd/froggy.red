;redcode
;name Froggy
;author C. L. Gonsalves
;strategy Will try to jump over attackers approaching from lower memory
;strategy (ie: imps)
;assert 1
ptr1	dat 0
ptr2	dat -252
start 	mov #7, -98
scan	cmp -99, #7
	jmp scan
copy	mov @ptr1, @ptr2
	cmp ptr1, #12
	jmp 4
	add #1, ptr1
	add #1, ptr2
	jmp copy
	mov #-252, -261
	jmp -261

	end start

