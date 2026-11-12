;redcode-nano
;assert CORESIZE==80
;author hwm
;name the smurf was
;strategy wearing a bitter smile
;strategy and carrying a handbag
;strategy bi-directional clear

step equ 37
bitter equ smile+1
handbag equ (CORESIZE/2)

boot  	mov.i  >  -(handbag/2), $(handbag/2)-1
     	mov.i  <step, $11
smile 	spl.x  #-9, >handbag 
     	mov.i  }31, {smile
	mov.i  >smile, {bitter

end boot

