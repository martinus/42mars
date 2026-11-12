;redcode-nano
;name Dodecadence
;author G.Labarga
;assert CORESIZE==80

pstep equ 63
at0 equ 32
at1 equ 22
at2 equ 36

org qB
qB:	mov {41,21
paper:	spl #0,<pstep
	mov }-1,>-1
	mov <at1,<at0
	djn.f *pstep-2,<at2
end
