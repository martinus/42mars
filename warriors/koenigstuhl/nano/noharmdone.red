;redcode-nano
;assert CORESIZE==80
;author hwm
;name no harm done
;strategy paper/imp
;strategy i was wrong, paper/imps do draw!
step equ 27
x1 equ 10
pp:   	spl.b  #    -step, >      -8      
	mov.i  }     pp-1, }      pp
	djn.i  { -step+bt, <      13 
bt:   	spl            pp, <-step+10
     	mov.i  #        1,         1
     	end   bt

