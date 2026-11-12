;name Elusive
;author Simon Duff
;strategy look for where the coreclear has been,
;strategy copy itself there, then hope that I'm
;strategy faster!
;assert 1
		ORG scan
		sub.ab	#27,ptr
scan:		sne		@ptr, -2
ptr:		djn.f	-2,	<-200	; decrements may throw off oneshots

; found something, this is where I will jump
; consider reversing this
		mov.i	}boot, >ptr
		mov.i	}boot, >ptr
		mov.i	}boot, >ptr
		mov.i	}boot, >ptr
		mov.i	}boot, >ptr
boot:		mov.i	cptr,  @ptr
		sub.ab	#3, ptr	; adjust to start from correct position
		jmp		@ptr

; my core clear code
cptr:	dat	#2,	#108 ; value should be a likely spot the enemy will be
top:	dat	#1,	#8
		spl	#1,	#8
		mov	*cptr, >cptr
		mov	*cptr, >cptr
		jmp   -2, >(cptr-5)

