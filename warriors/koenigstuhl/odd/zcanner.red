;redcode-94nop
;name Zcanner
;strategy A scanner in a round full of stones...stupid! (or not?)
;strategy (Based on B-Scanner live in Vain, Matt Hastings)
;author Roy van Rijn
;assert 1

start	add #1226,3
	jmz -1,@2
	mov grave,@1
	mov prog,<0
	jmn -4,-4
prog    nop 0,0
        mov @10,<-1
grave	jmp -1,0
end	start
