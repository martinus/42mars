;redcode-94
;name test2
;author Christian m.
;strategy simple one prozess replicator
;assert CORESIZE==8000

size	equ	10
counter	equ	9

start	nop	@0		,	size
	mov.I	}start	        ,	>start
	djn	start	        ,	#counter
	mov.ab	#9	        ,	start+size+2
	seq.I	start+size+1	,	-3
	jmp	-5
	jmp	start+size      ,       <120
bomb	dat	#0		,	<1

end   start