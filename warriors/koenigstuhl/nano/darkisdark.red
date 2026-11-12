;redcode-nano
;assert CORESIZE==80
;author hwm
;name how dark is dark
;strategy imp
step equ 27
x1 equ 10
mp2: 	spl.b # -step-mp1-1, > -step+mp1     
	mov.i #           1, }         1
    	djn.x }     step-x1, <        -7
mp1: 	spl            mp2, <      step
    	mov.i #           1,           1
    	end   mp1
