;redcode
;name Larry
;author Sascha Zapf
;strategy Hopper
;assert 1
;       CORESIZE==800
;strategy Third entry for the Recoder's Frenzy 11th rd.

step	EQU	596
gate	EQU	752


; Launch

start	spl		start,	}start
		jmp		hop,	}gate

; Body

ptr		dat.f	#ptr,	#step
hop		mov.i	}ptr,	>ptr
		jmp		step-1,	>-gate

		end		start
