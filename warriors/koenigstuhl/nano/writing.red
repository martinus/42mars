;redcode-nano
;assert 1
;author hwm
;name writing on the wall2
;strategy twin clear

step 	equ -6
q1 	equ 49

	mov.i < 23, $ 14
	mov.i < 18, $ q1
clr1 	spl.a # 0, } step
clr2 	mov.i * q1, < clr1
	djn.f $ clr2, < 41

	end

