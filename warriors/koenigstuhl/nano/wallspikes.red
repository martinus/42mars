;redcode-nano
;author G.Labarga
;name Wall of spikes
;assert 1

pstep equ 62
dec equ 12
at0 equ 11
at1 equ 37
at2 equ 44


head:	spl #0,<pstep
	mov }-1,>-1
	mov >at0,<at1
	mov }-1,{at2
	djn.f *pstep-3,<dec
end head
