;redcode-nano
;assert 1
;author hwm
;name proceed as normal
;strategy imp

step 	equ 39

boot 	spl.ab # step-1, > 30
	mov.i > -23, { boot
	mov.i # step, > -8
	spl.i { 2, > 18
	mov.i # -step, } 1

	end

