;redcode-nano
;assert CORESIZE == 80
;name Sabertooth
;author Ken Hubbard
;strategy Two concurrent clears, created by RedRace: SPL# MOV MOV JMP-2

start	spl.f	# 9, 		} start
attack1	mov.i	> target, 	} start
attack2	mov.i	> -22, 		> target
	jmp.i	attack1, 	} attack2
target	spl.x	} 0, 		} 24

end start

