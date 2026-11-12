;redcode-nano
;assert 1
;author G.Labarga
;name Nano'Broda

pstep equ 63
cte1 equ 7
cte2 equ 57
cte3 equ 32
cte4 equ 41

start:	spl #0,<pstep
	mov.i }-1,>-1
	mov.i <cte1,<cte2
	mov.i }-1,{cte3
	djn.f *pstep-3,<cte4
end start
