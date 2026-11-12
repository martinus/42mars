;redcode-nano
;author hwm
;name lights over the arctic plain
;strategy scanner
;assert CORESIZE==80

c1 	equ (CORESIZE/1)

scan 	sne.x $ c1-7, $  40
       	add.i $ 3,    $  c1+scan        
	mov.i < 12,   *  c1+scan
       	mov.i { c1-1, @  c1+scan
        djn.x $ c1-4, $  c1+scan
end scan

