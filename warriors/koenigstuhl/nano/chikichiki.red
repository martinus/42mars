;redcode-nano
;author G.Labarga
;name Chiki Chiki
;assert 1

ploc equ 57
at0 equ 23
at1 equ 75
at2 equ 49

head:	spl #0,>at1
	mov }-1,}1
	spl <ploc,}1
	mov <at0,<head
	djn.f -1,<at2
end
